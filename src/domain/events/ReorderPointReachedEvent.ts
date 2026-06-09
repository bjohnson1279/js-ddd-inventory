import { IDomainEvent } from "./IDomainEvent";

export class ReorderPointReachedEvent implements IDomainEvent {
  public readonly occurredOn: Date;
  public readonly eventName: string = "ReorderPointReachedEvent";

  constructor(
    public readonly sku: string,
    public readonly locationId: string,
    public readonly currentQuantity: number,
    public readonly reorderPoint: number,
    public readonly reorderQuantity: number
  ) {
    this.occurredOn = new Date();
  }
}
