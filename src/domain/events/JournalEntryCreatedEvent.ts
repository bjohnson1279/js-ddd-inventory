import { IDomainEvent } from "./IDomainEvent";

export class JournalEntryCreatedEvent implements IDomainEvent {
  public readonly occurredOn: Date;
  public readonly eventName: string = "JournalEntryCreatedEvent";

  constructor(
    public readonly aggregateId: string, // Journal entry ID
    public readonly tenantId: string,
    public readonly description: string,
    public readonly date: string,
    public readonly lines: Array<{
      accountCode: string;
      accountName: string;
      amountCents: number;
      type: "debit" | "credit";
      memo: string;
    }>
  ) {
    this.occurredOn = new Date();
  }
}
