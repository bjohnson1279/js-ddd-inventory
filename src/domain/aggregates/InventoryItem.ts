import { SKU } from "../valueObjects/SKU";
import { Quantity } from "../valueObjects/Quantity";

import { AggregateRoot } from "./AggregateRoot";
import { StockDepletedEvent } from "../events/StockDepletedEvent";

export class InventoryItem extends AggregateRoot {
  private readonly _id: string;
  private readonly _sku: SKU;
  private readonly _locationId: string;
  private _quantity: Quantity;
  private _shopifyInventoryItemId?: string;

  private constructor(id: string, sku: SKU, locationId: string, quantity: Quantity, shopifyInventoryItemId?: string) {
    super();
    this._id = id;
    this._sku = sku;
    this._locationId = locationId;
    this._quantity = quantity;
    this._shopifyInventoryItemId = shopifyInventoryItemId;
  }

  public static create(
    id: string,
    sku: SKU,
    locationId: string,
    quantity: Quantity,
    shopifyInventoryItemId?: string
  ): InventoryItem;

  public static create(
    id: string,
    sku: SKU,
    quantity: Quantity,
    shopifyInventoryItemId?: string
  ): InventoryItem;

  public static create(
    id: string,
    sku: SKU,
    arg3?: string | Quantity,
    arg4?: Quantity | string,
    arg5?: string
  ): InventoryItem {
    let locationId = "default";
    let quantity = Quantity.create(0);
    let shopifyInventoryItemId: string | undefined = undefined;

    if (typeof arg3 === "string") {
      locationId = arg3;
      if (arg4 instanceof Quantity) {
        quantity = arg4;
      }
      shopifyInventoryItemId = arg5;
    } else if (arg3 instanceof Quantity) {
      quantity = arg3;
      if (typeof arg4 === "string") {
        shopifyInventoryItemId = arg4;
      }
    }

    return new InventoryItem(id, sku, locationId, quantity, shopifyInventoryItemId);
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

  public receiveStock(amount: Quantity): void {
    this._quantity = this._quantity.add(amount);
  }

  public dispatchStock(amount: Quantity): void {
    this._quantity = this._quantity.subtract(amount);
    
    if (this._quantity.getValue() === 0) {
      this.addDomainEvent(new StockDepletedEvent(this._id, this._sku.getValue()));
    }
  }

  public reconcileCount(actualQuantity: Quantity): void {
    const previousQuantity = this._quantity.getValue();
    this._quantity = actualQuantity;
    
    if (previousQuantity > 0 && actualQuantity.getValue() === 0) {
      this.addDomainEvent(new StockDepletedEvent(this._id, this._sku.getValue()));
    }
  }
}
