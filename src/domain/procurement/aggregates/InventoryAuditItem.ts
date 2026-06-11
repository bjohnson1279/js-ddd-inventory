export class InventoryAuditItem {
  private _countedQuantity: number | null;
  private _isCounted: boolean;

  constructor(
    public readonly id: string,
    public readonly variantId: string,
    public readonly expectedQuantity: number,
    countedQuantity: number | null = null,
    isCounted: boolean = false
  ) {
    if (expectedQuantity < 0) {
      throw new Error("Expected quantity cannot be negative.");
    }
    if (countedQuantity !== null && countedQuantity < 0) {
      throw new Error("Counted quantity cannot be negative.");
    }
    this._countedQuantity = countedQuantity;
    this._isCounted = isCounted;
  }

  public get countedQuantity(): number | null {
    return this._countedQuantity;
  }

  public get isCounted(): boolean {
    return this._isCounted;
  }

  public get discrepancy(): number | null {
    if (!this._isCounted || this._countedQuantity === null) {
      return null;
    }
    return this._countedQuantity - this.expectedQuantity;
  }

  public recordCount(quantity: number): void {
    if (quantity < 0) {
      throw new Error("Counted quantity cannot be negative.");
    }
    this._countedQuantity = quantity;
    this._isCounted = true;
  }
}
