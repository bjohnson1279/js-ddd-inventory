import { SKU } from "../valueObjects/SKU";
import { Quantity } from "../valueObjects/Quantity";

import { AggregateRoot } from "./AggregateRoot";
import { StockDepletedEvent } from "../events/StockDepletedEvent";
import { InsufficientAvailableStockException } from "../exceptions/InsufficientAvailableStockException";

export class InventoryItem extends AggregateRoot {
  private readonly _id: string;
  private readonly _sku: SKU;
  private readonly _locationId: string;
  private _quantity: Quantity;
  private _allocated: Quantity;
  private _inTransit: Quantity;
  private _version: number;
  private _shopifyInventoryItemId?: string;

  private constructor(
    id: string,
    sku: SKU,
    locationId: string,
    quantity: Quantity,
    allocated: Quantity = Quantity.create(0),
    inTransit: Quantity = Quantity.create(0),
    version: number = 1,
    shopifyInventoryItemId?: string
  ) {
    super();
    this._id = id;
    this._sku = sku;
    this._locationId = locationId;
    this._quantity = quantity;
    this._allocated = allocated;
    this._inTransit = inTransit;
    this._version = version;
    this._shopifyInventoryItemId = shopifyInventoryItemId;
  }

  public static create(
    id: string,
    sku: SKU,
    locationId: string,
    quantity: Quantity,
    allocated?: Quantity,
    inTransit?: Quantity,
    version?: number,
    shopifyInventoryItemId?: string
  ): InventoryItem;

  public static create(
    id: string,
    sku: SKU,
    quantity: Quantity,
    allocated?: Quantity,
    inTransit?: Quantity,
    version?: number,
    shopifyInventoryItemId?: string
  ): InventoryItem;

  public static create(
    id: string,
    sku: SKU,
    arg3?: any,
    arg4?: any,
    arg5?: any,
    arg6?: any,
    arg7?: any,
    arg8?: any
  ): InventoryItem {
    let locationId = "default";
    let quantity = Quantity.create(0);
    let allocated = Quantity.create(0);
    let inTransit = Quantity.create(0);
    let version = 1;
    let shopifyInventoryItemId: string | undefined = undefined;

    if (typeof arg3 === "string") {
      locationId = arg3;
      if (arg4 instanceof Quantity) {
        quantity = arg4;
      }
      if (arg5 instanceof Quantity) {
        allocated = arg5;
      }
      if (arg6 instanceof Quantity) {
        inTransit = arg6;
      }
      if (typeof arg7 === "number") {
        version = arg7;
      }
      if (typeof arg8 === "string") {
        shopifyInventoryItemId = arg8;
      } else if (typeof arg5 === "string") {
        shopifyInventoryItemId = arg5;
      }
    } else if (arg3 instanceof Quantity) {
      quantity = arg3;
      if (arg4 instanceof Quantity) {
        allocated = arg4;
      }
      if (arg5 instanceof Quantity) {
        inTransit = arg5;
      }
      if (typeof arg6 === "number") {
        version = arg6;
      }
      if (typeof arg7 === "string") {
        shopifyInventoryItemId = arg7;
      } else if (typeof arg4 === "string") {
        shopifyInventoryItemId = arg4;
      }
    }

    return new InventoryItem(id, sku, locationId, quantity, allocated, inTransit, version, shopifyInventoryItemId);
  }

  public get locationId(): string {
    return this._locationId;
  }

  public get shopifyInventoryItemId(): string | undefined {
    return this._shopifyInventoryItemId;
  }

  public setShopifyInventoryItemId(id: string): void {
    this._shopifyInventoryItemId = id;
  }

  public get id(): string {
    return this._id;
  }

  public get sku(): SKU {
    return this._sku;
  }

  public get quantity(): Quantity {
    return this._quantity;
  }

  public get allocated(): Quantity {
    return this._allocated;
  }

  public get inTransit(): Quantity {
    return this._inTransit;
  }

  public get version(): number {
    return this._version;
  }

  public get available(): Quantity {
    const val = this._quantity.getValue() - this._allocated.getValue() + this._inTransit.getValue();
    return Quantity.create(val < 0 ? 0 : val);
  }

  private incrementVersion(): void {
    this._version += 1;
  }

  public receiveStock(amount: Quantity): void {
    this._quantity = this._quantity.add(amount);
    this.incrementVersion();
  }

  public dispatchStock(amount: Quantity): void {
    this._quantity = this._quantity.subtract(amount);
    this.incrementVersion();
    
    if (this._quantity.getValue() === 0) {
      this.addDomainEvent(new StockDepletedEvent(this._id, this._sku.getValue()));
    }
  }

  public reconcileCount(actualQuantity: Quantity): void {
    const previousQuantity = this._quantity.getValue();
    this._quantity = actualQuantity;
    this.incrementVersion();
    
    if (previousQuantity > 0 && actualQuantity.getValue() === 0) {
      this.addDomainEvent(new StockDepletedEvent(this._id, this._sku.getValue()));
    }
  }

  public allocateStock(amount: Quantity): void {
    if (this.available.getValue() < amount.getValue()) {
      throw new InsufficientAvailableStockException(this._sku.getValue(), amount.getValue(), this.available.getValue());
    }
    this._allocated = this._allocated.add(amount);
    this.incrementVersion();
  }

  public releaseAllocation(amount: Quantity): void {
    if (this._allocated.getValue() < amount.getValue()) {
      throw new Error(`Cannot release allocation of ${amount.getValue()} because only ${this._allocated.getValue()} is allocated.`);
    }
    this._allocated = this._allocated.subtract(amount);
    this.incrementVersion();
  }

  public fulfillAllocation(amount: Quantity): void {
    if (this._allocated.getValue() < amount.getValue()) {
      throw new Error(`Cannot fulfill allocation of ${amount.getValue()} because only ${this._allocated.getValue()} is allocated.`);
    }
    this._allocated = this._allocated.subtract(amount);
    this._quantity = this._quantity.subtract(amount);
    this.incrementVersion();
  }

  public createInTransit(amount: Quantity): void {
    this._inTransit = this._inTransit.add(amount);
    this.incrementVersion();
  }

  public receiveInTransit(amount: Quantity): void {
    if (this._inTransit.getValue() < amount.getValue()) {
      throw new Error(`Cannot receive in transit of ${amount.getValue()} because only ${this._inTransit.getValue()} is in transit.`);
    }
    this._inTransit = this._inTransit.subtract(amount);
    this._quantity = this._quantity.add(amount);
    this.incrementVersion();
  }

  public cancelInTransit(amount: Quantity): void {
    if (this._inTransit.getValue() < amount.getValue()) {
      throw new Error(`Cannot cancel in transit of ${amount.getValue()} because only ${this._inTransit.getValue()} is in transit.`);
    }
    this._inTransit = this._inTransit.subtract(amount);
    this.incrementVersion();
  }
}
