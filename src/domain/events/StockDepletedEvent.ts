import { IDomainEvent } from "./IDomainEvent";

export class StockDepletedEvent implements IDomainEvent {
  public readonly occurredOn: Date;
  public readonly eventName: string = "StockDepletedEvent";

  constructor(
    public readonly aggregateId: string,
    public readonly sku: string
  ) {
    this.occurredOn = new Date();
  }
}
