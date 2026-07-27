import { IDomainEvent } from "./IDomainEvent";

export class RfidScanProcessedEvent implements IDomainEvent {
  public readonly occurredOn: Date;
  public readonly eventName: string = "RfidScanProcessedEvent";

  constructor(
    public readonly aggregateId: string, // Scan Batch ID or Location ID
    public readonly tenantId: string,
    public readonly locationId: string,
    public readonly totalScanned: number,
    public readonly matchedCount: number,
    public readonly unmatchedCount: number,
    public readonly unmatchedEpcs: string[]
  ) {
    this.occurredOn = new Date();
  }
}
