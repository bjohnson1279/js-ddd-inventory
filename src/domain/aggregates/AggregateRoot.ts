import { IDomainEvent } from "../events/IDomainEvent";

export abstract class AggregateRoot {
  private _domainEvents: IDomainEvent[] = [];

  public getDomainEvents(): IDomainEvent[] {
    return [...this._domainEvents];
  }

  protected addDomainEvent(event: IDomainEvent): void {
    this._domainEvents.push(event);
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }
}
