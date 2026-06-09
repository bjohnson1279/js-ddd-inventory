export class InventoryCostLayer {
  private _remainingQuantity: number;

  constructor(
    public readonly id: string,
    public readonly variantId: string,
    public readonly tenantId: string,
    public readonly originalQuantity: number,
    public readonly unitCostCents: number,
    public readonly receivedAt: Date,
    public readonly purchaseOrderId: string,
    public readonly locationId?: string | null
  ) {
    this._remainingQuantity = originalQuantity;
  }

  public consume(needed: number): number {
    const consumed = Math.min(needed, this._remainingQuantity);
    this._remainingQuantity -= consumed;
    return consumed;
  }

  public get remainingQuantity(): number {
    return this._remainingQuantity;
  }

  public remainingCostCents(): number {
    return this._remainingQuantity * this.unitCostCents;
  }

  public isExhausted(): boolean {
    return this._remainingQuantity === 0;
  }
}
