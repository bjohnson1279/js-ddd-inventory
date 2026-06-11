import { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";
import { DomainEventDispatcher } from "../../domain/events/DomainEventDispatcher";

export class OutboxProcessor {
  private isProcessing = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly outboxRepository: IOutboxRepository
  ) {}

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
      const pendingEvents = await this.outboxRepository.fetchPending(10); // Batch of 10

      const processedIds: string[] = [];
      const failedUpdates: { id: string, error: string }[] = [];

      for (const record of pendingEvents) {
        try {
          const parsed = JSON.parse(record.payload);
          const eventInstance = {
            ...parsed,
            occurredOn: new Date(parsed.occurredOn)
          };

          // Dispatch the single event to registered handlers
          await DomainEventDispatcher.dispatch([eventInstance]);

          // Collect successfully processed IDs
          processedIds.push(record.id);
        } catch (error: any) {
          console.error(`Error processing outbox event ${record.id}:`, error);
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
