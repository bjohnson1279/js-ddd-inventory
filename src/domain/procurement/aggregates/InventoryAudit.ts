import { AggregateRoot } from "../../aggregates/AggregateRoot";
import { AuditStatus } from "../enums/AuditStatus";
import { InventoryAuditItem } from "./InventoryAuditItem";

export class InventoryAudit extends AggregateRoot {
  private _status: AuditStatus;
  private readonly _items: InventoryAuditItem[];

  constructor(
    public readonly id: string,
    public readonly auditNumber: string,
    public readonly tenantId: string,
    public readonly locationId: string,
    status: AuditStatus = AuditStatus.Draft,
    items: InventoryAuditItem[] = [],
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {
    super();
    this._status = status;
    this._items = [...items];
  }

  public get status(): AuditStatus {
    return this._status;
  }

  public get items(): InventoryAuditItem[] {
    return [...this._items];
  }

  public start(): void {
    if (this._status !== AuditStatus.Draft) {
      throw new Error("Only draft audits can be started.");
    }
    this._status = AuditStatus.InProgress;
  }

  public recordCount(variantId: string, quantity: number): void {
    if (this._status !== AuditStatus.InProgress) {
      throw new Error("Can only record counts on in-progress audits.");
    }
    const item = this._items.find((i) => i.variantId === variantId);
    if (!item) {
      throw new Error(`Item with variant ID ${variantId} not found in this audit.`);
    }
    item.recordCount(quantity);
  }

  public complete(): void {
    if (this._status !== AuditStatus.InProgress) {
      throw new Error("Only in-progress audits can be completed.");
    }
    const uncounted = this._items.filter((i) => !i.isCounted);
    if (uncounted.length > 0) {
      throw new Error("Cannot complete audit: some items have not been counted.");
    }
    this._status = AuditStatus.Completed;
  }

  public reconcile(): void {
    if (this._status !== AuditStatus.Completed) {
      throw new Error("Only completed audits can be reconciled.");
    }
    this._status = AuditStatus.Reconciled;
  }
}
