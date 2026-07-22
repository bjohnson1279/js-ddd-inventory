import { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";
import { DomainEventDispatcher } from "../../domain/events/DomainEventDispatcher";
import { IMessageBroker } from "../../application/ports/IMessageBroker";
import { runWithTrace, generateTraceId } from "../telemetry/traceContext";
import { prisma } from "../database/prisma";

export class OutboxProcessor {
  private isProcessing = false;
  private intervalId: NodeJS.Timeout | null = null;

  private readonly maxAttempts: number;

  constructor(
    private readonly outboxRepository: IOutboxRepository,
    private readonly messageBroker?: IMessageBroker,
    maxAttempts: number = 5
  ) {
    this.maxAttempts = maxAttempts;
  }

  public start(intervalMs: number = 5000): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.processPending(), intervalMs);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public async processPending(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingEvents = await this.outboxRepository.fetchPending(10, this.maxAttempts); // Batch of 10

      const processedIds: string[] = [];
      const failedUpdates: { id: string, error: string }[] = [];

      for (const record of pendingEvents) {
        try {
          const parsed = JSON.parse(record.payload);
          const traceId = parsed.traceId || generateTraceId();

          await runWithTrace(traceId, async () => {
            const eventInstance = {
              ...parsed,
              occurredOn: new Date(parsed.occurredOn)
            };

            // Dispatch the single event to registered handlers
            await DomainEventDispatcher.dispatch([eventInstance]);

            // Publish to external message broker if configured
            if (this.messageBroker) {
              await this.messageBroker.publish(record.eventName, eventInstance);
            }

            // Enqueue webhooks for active subscriptions matching tenant and event type
            let eventTenantId = "tenant-1";
            try {
              const payloadObj = JSON.parse(record.payload);
              eventTenantId = payloadObj?.tenantId || (payloadObj?.tenantId && typeof payloadObj.tenantId === "object" ? payloadObj.tenantId.value : payloadObj?.tenantId) || "tenant-1";
            } catch (e) {}

            const subscriptions = await prisma.webhookSubscriptionModel.findMany({
              where: {
                tenantId: eventTenantId,
                isActive: true,
                eventTypes: {
                  has: record.eventName
                }
              }
            });

            if (subscriptions.length > 0) {
              await Promise.all(subscriptions.map(sub =>
                prisma.webhookDeliveryModel.create({
                  data: {
                    tenantId: eventTenantId,
                    subscriptionId: sub.id,
                    eventType: record.eventName,
                    payload: record.payload,
                    status: "Pending",
                    attempts: 0,
                    nextAttemptAt: new Date()
                  }
                })
              ));
            }

            // Collect successfully processed IDs
            processedIds.push(record.id);
          });
        } catch (error: any) {
          const parsed = JSON.parse(record.payload);
          const traceId = parsed.traceId || "unknown";
          console.error(`[Trace: ${traceId}] Error processing outbox event ${record.id}:`, error);
          failedUpdates.push({ id: record.id, error: error.message || String(error) });
        }
      }

      // Execute database updates concurrently
      await Promise.all([
        ...processedIds.map(id => this.outboxRepository.markProcessed(id)),
        ...failedUpdates.map(f => this.outboxRepository.markFailed(f.id, f.error))
      ]);
    } catch (error) {
      console.error("Failed to fetch pending outbox events:", error);
    } finally {
      this.isProcessing = false;
    }
  }
}
