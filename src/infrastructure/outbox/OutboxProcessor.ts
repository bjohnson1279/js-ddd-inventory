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

      for (const record of pendingEvents) {
        try {
          const parsed = JSON.parse(record.payload);
          const eventInstance = {
            ...parsed,
            occurredOn: new Date(parsed.occurredOn)
          };

          // Dispatch the single event to registered handlers
          await DomainEventDispatcher.dispatch([eventInstance]);

          // Mark as successfully processed
          await this.outboxRepository.markProcessed(record.id);
        } catch (error: any) {
          console.error(`Error processing outbox event ${record.id}:`, error);
          await this.outboxRepository.markFailed(record.id, error.message || String(error));
        }
      }
    } catch (error) {
      console.error("Failed to fetch pending outbox events:", error);
    } finally {
      this.isProcessing = false;
    }
  }
}
