import { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";
import { IDomainEvent } from "../../domain/events/IDomainEvent";
import { getTraceId } from "../telemetry/traceContext";

export class InMemoryOutboxRepository implements IOutboxRepository {
  public entries: any[] = [];

  async save(event: IDomainEvent, tx?: any): Promise<void> {
    const payload = JSON.stringify({
      ...event,
      traceId: (event as any).traceId || getTraceId(),
      occurredOn: event.occurredOn.toISOString()
    });

    this.entries.push({
      id: crypto.randomUUID(),
      eventName: event.eventName,
      payload,
      occurredOn: event.occurredOn,
      processedAt: null,
      attempts: 0,
      lastError: null,
      nextAttemptAt: new Date()
    });
  }

  async fetchPending(limit: number, maxAttempts: number = 5): Promise<any[]> {
    const now = new Date();
    return this.entries
      .filter((e) => e.processedAt === null && e.attempts < maxAttempts && (!e.nextAttemptAt || e.nextAttemptAt <= now))
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
      const backoffMs = Math.min(Math.pow(2, entry.attempts) * 1000, 24 * 60 * 60 * 1000);
      entry.nextAttemptAt = new Date(Date.now() + backoffMs);
    }
  }

  async fetchDeadLettered(limit: number, maxAttempts: number = 5): Promise<any[]> {
    return this.entries
      .filter((e) => e.processedAt === null && e.attempts >= maxAttempts)
      .sort((a, b) => b.occurredOn.getTime() - a.occurredOn.getTime())
      .slice(0, limit);
  }

  async retryEvent(id: string): Promise<void> {
    const entry = this.entries.find((e) => e.id === id);
    if (entry) {
      entry.attempts = 0;
      entry.lastError = null;
      entry.nextAttemptAt = new Date();
    }
  }

  async fetchStats(maxAttempts: number = 5): Promise<any> {
    const pendingCount = this.entries.filter((e) => e.processedAt === null && e.attempts < maxAttempts).length;
    const processedCount = this.entries.filter((e) => e.processedAt !== null).length;
    const deadLetteredCount = this.entries.filter((e) => e.processedAt === null && e.attempts >= maxAttempts).length;
    const recentFailures = this.entries
      .filter((e) => e.processedAt === null && e.attempts > 0 && e.attempts < maxAttempts)
      .sort((a, b) => b.occurredOn.getTime() - a.occurredOn.getTime())
      .slice(0, 10);

    return {
      totalPending: pendingCount,
      totalProcessed: processedCount,
      totalDeadLettered: deadLetteredCount,
      recentFailures
    };
  }
}
