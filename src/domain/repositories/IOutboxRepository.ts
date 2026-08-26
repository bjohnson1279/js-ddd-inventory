import { IDomainEvent } from "../events/IDomainEvent";

export interface IOutboxRepository {
  save(event: IDomainEvent, tx?: any): Promise<void>;
  fetchPending(limit: number, maxAttempts?: number): Promise<any[]>;
  markProcessed(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  fetchDeadLettered(limit: number, maxAttempts?: number): Promise<any[]>;
  retryEvent(id: string): Promise<void>;
  fetchStats(maxAttempts?: number): Promise<{
    totalPending: number;
    totalProcessed: number;
    totalDeadLettered: number;
    recentFailures: any[];
  }>;
}
