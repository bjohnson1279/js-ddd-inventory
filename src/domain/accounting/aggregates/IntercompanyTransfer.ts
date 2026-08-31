import { v4 as uuidv4 } from 'uuid';

export class IntercompanyTransfer {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly fromEntityId: string,
    public readonly toEntityId: string,
    public readonly sku: string,
    public readonly quantity: number,
    public readonly transferPriceCents: number,
    public readonly dutyCents: number,
    public status: string,
    public journalEntryId: string | null,
    public readonly createdAt: Date
  ) {}

  public static initiate(
    tenantId: string,
    fromEntityId: string,
    toEntityId: string,
    sku: string,
    quantity: number,
    transferPriceCents: number,
    dutyCents: number = 0
  ): IntercompanyTransfer {
    return new IntercompanyTransfer(
      uuidv4(),
      tenantId,
      fromEntityId,
      toEntityId,
      sku,
      quantity,
      transferPriceCents,
      dutyCents,
      'COMPLETED', // Synchronous processing for now
      null,
      new Date()
    );
  }

  public completeWithJournal(journalEntryId: string): void {
    this.status = 'COMPLETED';
    this.journalEntryId = journalEntryId;
  }
}
