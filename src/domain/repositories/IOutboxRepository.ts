import { IDomainEvent } from "../events/IDomainEvent";

export interface IOutboxRepository {
  save(event: IDomainEvent, tx?: any): Promise<void>;
  fetchPending(limit: number): Promise<any[]>;
  markProcessed(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}
