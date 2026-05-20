import { SKU } from "../valueObjects/SKU";
import { Quantity } from "../valueObjects/Quantity";

export class InventoryItem {
  private readonly _id: string;
  private readonly _sku: SKU;
  private _quantity: Quantity;
  private _shopifyInventoryItemId?: string;

  private constructor(id: string, sku: SKU, quantity: Quantity, shopifyInventoryItemId?: string) {
    this._id = id;
    this._sku = sku;
    this._quantity = quantity;
    this._shopifyInventoryItemId = shopifyInventoryItemId;
  }

  public static create(id: string, sku: SKU, quantity: Quantity, shopifyInventoryItemId?: string): InventoryItem {
    return new InventoryItem(id, sku, quantity, shopifyInventoryItemId);
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
  }

  public reconcileCount(actualQuantity: Quantity): void {
    this._quantity = actualQuantity;
  }
}
