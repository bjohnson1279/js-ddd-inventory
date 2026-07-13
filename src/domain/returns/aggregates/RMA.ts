import { AggregateRoot } from "../../aggregates/AggregateRoot";
import { RMAStatus } from "../enums/RMAStatus";
import { RMAItem } from "../entities/RMAItem";
import { RMADisposition } from "../enums/RMADisposition";

export class RMA extends AggregateRoot {
  private _status: RMAStatus;
  private readonly _items: RMAItem[];

  constructor(
    public readonly id: string,
    public readonly rmaNumber: string,
    public readonly tenantId: string,
    public readonly customerId: string,
    public readonly locationId: string,
    status: RMAStatus = RMAStatus.Requested,
    items: RMAItem[] = [],
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {
    super();
    this._status = status;
    this._items = [...items];
  }

  public get status(): RMAStatus {
    return this._status;
  }

  public get items(): RMAItem[] {
    return [...this._items];
  }

  public authorize(): void {
    if (this._status !== RMAStatus.Requested) {
      throw new Error("Only requested RMAs can be authorized.");
    }
    this._status = RMAStatus.Authorized;
  }

  // Pre-computed map for fast O(1) lookups during batch receives
  private _itemsMap?: Map<string, RMAItem>;

  public receiveItem(variantId: string, quantity: number, disposition: RMADisposition): void {
    if (
      this._status !== RMAStatus.Authorized &&
      this._status !== RMAStatus.Received
    ) {
      throw new Error("Can only receive items on Authorized or partially Received RMAs.");
    }

    if (!this._itemsMap) {
      this._itemsMap = new Map(this._items.map((i) => [i.variantId, i]));
    }

    const item = this._itemsMap.get(variantId);
    if (!item) {
      throw new Error(`Item ${variantId} not found in this RMA.`);
    }

    item.receive(quantity, disposition);

    const allProcessed = this._items.every((i) => i.isFullyProcessed());
    if (allProcessed) {
      this._status = RMAStatus.Completed;
    } else {
      this._status = RMAStatus.Received;
    }
  }

  public reject(): void {
    if (this._status !== RMAStatus.Requested && this._status !== RMAStatus.Authorized) {
      throw new Error("Cannot reject RMA after receipt has started.");
    }
    this._status = RMAStatus.Rejected;
  }
}
