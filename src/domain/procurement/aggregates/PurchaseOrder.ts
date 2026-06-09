import { AggregateRoot } from "../../aggregates/AggregateRoot";
import { PurchaseOrderStatus } from "../enums/PurchaseOrderStatus";
import { PurchaseOrderItem } from "./PurchaseOrderItem";

export class PurchaseOrder extends AggregateRoot {
  private _status: PurchaseOrderStatus;
  private readonly _items: PurchaseOrderItem[];

  constructor(
    public readonly id: string,
    public readonly purchaseOrderNumber: string,
    public readonly vendorId: string,
    public readonly tenantId: string,
    public readonly locationId: string,
    status: PurchaseOrderStatus = PurchaseOrderStatus.Draft,
    items: PurchaseOrderItem[] = []
  ) {
    super();
    this._status = status;
    this._items = [...items];
  }

  public get status(): PurchaseOrderStatus {
    return this._status;
  }

  public get items(): PurchaseOrderItem[] {
    return [...this._items];
  }

  public approve(): void {
    if (this._status !== PurchaseOrderStatus.Draft) {
      throw new Error("Only draft purchase orders can be approved.");
    }
    this._status = PurchaseOrderStatus.Approved;
  }

  public send(): void {
    if (this._status !== PurchaseOrderStatus.Approved) {
      throw new Error("Only approved purchase orders can be sent.");
    }
    this._status = PurchaseOrderStatus.Sent;
  }

  public receiveItems(variantId: string, quantity: number): void {
    if (
      this._status !== PurchaseOrderStatus.Sent &&
      this._status !== PurchaseOrderStatus.PartiallyReceived
    ) {
      throw new Error("Can only receive items on Sent or Partially Received purchase orders.");
    }

    const item = this._items.find((i) => i.variantId === variantId);
    if (!item) {
      throw new Error(`Item with variant ID ${variantId} not found in this purchase order.`);
    }

    item.receive(quantity);

    // Update status
    const allFullyReceived = this._items.every((i) => i.isFullyReceived());
    if (allFullyReceived) {
      this._status = PurchaseOrderStatus.Received;
    } else {
      this._status = PurchaseOrderStatus.PartiallyReceived;
    }
  }

  public close(): void {
    this._status = PurchaseOrderStatus.Closed;
  }
}
