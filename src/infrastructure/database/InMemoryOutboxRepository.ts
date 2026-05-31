import { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";
import { IDomainEvent } from "../../domain/events/IDomainEvent";

export class InMemoryOutboxRepository implements IOutboxRepository {
  public entries: any[] = [];

  async save(event: IDomainEvent, tx?: any): Promise<void> {
    const payload = JSON.stringify({
      ...event,
      occurredOn: event.occurredOn.toISOString()
    });

    this.entries.push({
      id: Math.random().toString(36).substring(2, 11),
      eventName: event.eventName,
      payload,
      occurredOn: event.occurredOn,
      processedAt: null,
      attempts: 0,
      lastError: null
    });
  }

  async fetchPending(limit: number): Promise<any[]> {
    return this.entries
      .filter((e) => e.processedAt === null)
      .slice(0, limit);
  }

  async markProcessed(id: string): Promise<void> {
    const entry = this.entries.find((e) => e.id === id);
    if (entry) {
      entry.processedAt = new Date();
    }
  }

  async markFailed(id: string, error: string): Promise<void> {
    const entry = this.entries.find((e) => e.id === id);
    if (entry) {
      entry.attempts += 1;
      entry.lastError = error;
    }
  }
}
