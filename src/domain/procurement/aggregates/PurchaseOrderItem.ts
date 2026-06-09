export class PurchaseOrderItem {
  private _receivedQuantity: number;

  constructor(
    public readonly id: string,
    public readonly variantId: string,
    public readonly quantity: number,
    public readonly unitCostCents: number,
    receivedQuantity: number = 0
  ) {
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }
    if (unitCostCents < 0) {
      throw new Error("Unit cost cannot be negative.");
    }
    this._receivedQuantity = receivedQuantity;
  }

  public get receivedQuantity(): number {
    return this._receivedQuantity;
  }

  public receive(amount: number): void {
    if (amount <= 0) {
      throw new Error("Receive amount must be greater than zero.");
    }
    if (this._receivedQuantity + amount > this.quantity) {
      throw new Error(
        `Cannot receive ${amount} items. Total received would exceed ordered quantity of ${this.quantity}.`
      );
    }
    this._receivedQuantity += amount;
  }

  public isFullyReceived(): boolean {
    return this._receivedQuantity === this.quantity;
  }
}
