import { SerializedItemStatus, canTransitionTo, requiresLedgerEntry } from "../enums/SerializedItemStatus";
import { SerialNumber } from "../valueObjects/SerialNumber";
import { StatusTransition } from "../valueObjects/StatusTransition";
import { InvalidSerialStatusTransitionException } from "../exceptions/InvalidSerialStatusTransitionException";

export class SerializedItem {
  private _status: SerializedItemStatus;
  private _locationId: string;
  private readonly _history: StatusTransition[] = [];
  private _domainEvents: any[] = [];

  constructor(
    public readonly id: string,
    public readonly variantId: string,
    public readonly serialNumber: SerialNumber,
    public readonly tenantId: string,
    locationId: string,
    initialStatus: SerializedItemStatus = SerializedItemStatus.Pending,
    history: StatusTransition[] = []
  ) {
    this._status = initialStatus;
    this._locationId = locationId;
    this._history = [...history];
  }

  public receive(location: string, actor: string, purchaseOrderId: string): void {
    this.transitionTo(
      SerializedItemStatus.InStock,
      `Received against PO ${purchaseOrderId}`,
      actor,
      purchaseOrderId
    );
    this._locationId = location;
  }

  public sell(saleId: string, actor: string): void {
    this.transitionTo(
      SerializedItemStatus.Sold,
      `Sold — sale ${saleId}`,
      actor,
      saleId
    );
  }

  public acceptReturn(returnId: string, actor: string): void {
    this.transitionTo(
      SerializedItemStatus.Returned,
      `Customer return — ${returnId}`,
      actor,
      returnId
    );
  }

  public restock(actor: string, returnId: string): void {
    this.transitionTo(
      SerializedItemStatus.InStock,
      `Restocked after inspection — return ${returnId}`,
      actor,
      returnId
    );
  }

  public markDamaged(reason: string, actor: string, referenceId: string | null = null): void {
    this.transitionTo(SerializedItemStatus.Damaged, reason, actor, referenceId);
  }

  public quarantine(reason: string, actor: string, referenceId: string | null = null): void {
    this.transitionTo(SerializedItemStatus.Quarantined, reason, actor, referenceId);
  }

  public transferOut(destination: string, actor: string, transferId: string): void {
    this.transitionTo(
      SerializedItemStatus.Transferred,
      `Transfer out to ${destination} — ${transferId}`,
      actor,
      transferId
    );
  }

  public transferIn(newLocation: string, actor: string, transferId: string): void {
    this.transitionTo(
      SerializedItemStatus.InStock,
      `Transfer in — ${transferId}`,
      actor,
      transferId
    );
    this._locationId = newLocation;
  }

  public writeOff(reason: string, actor: string, referenceId: string | null = null): void {
    this.transitionTo(SerializedItemStatus.WrittenOff, reason, actor, referenceId);
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  public get status(): SerializedItemStatus {
    return this._status;
  }

  public get locationId(): string {
    return this._locationId;
  }

  public isAvailable(): boolean {
    return this._status === SerializedItemStatus.InStock;
  }

  public get history(): StatusTransition[] {
    return [...this._history];
  }

  public lastTransition(): StatusTransition | null {
    return this._history.length > 0 ? this._history[this._history.length - 1] : null;
  }

  public releaseEvents(): any[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  // -------------------------------------------------------------------------
  // Private transition engine
  // -------------------------------------------------------------------------

  private transitionTo(
    target: SerializedItemStatus,
    reason: string,
    actor: string,
    referenceId: string | null
  ): void {
    if (!canTransitionTo(this._status, target)) {
      throw new InvalidSerialStatusTransitionException(
        this.serialNumber,
        this._status,
        target
      );
    }

    const transition = new StatusTransition(
      this._status,
      target,
      reason,
      actor,
      referenceId,
      new Date()
    );

    this._history.push(transition);
    const oldStatus = this._status;
    this._status = target;

    this._domainEvents.push({
      type: "SerialStatusChanged",
      itemId: this.id,
      serialNumber: this.serialNumber.value,
      from: oldStatus,
      to: target,
      reason,
      actor,
      referenceId,
      occurredAt: transition.occurredAt,
      requiresLedgerEntry: requiresLedgerEntry(oldStatus, target),
    });
  }
}
