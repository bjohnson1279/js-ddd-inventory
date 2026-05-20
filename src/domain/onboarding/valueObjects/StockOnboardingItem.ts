export class StockOnboardingItem {
  constructor(
    public readonly variantId: string,
    public readonly quantity: number,
    public readonly unitCostCents: number // store cost in cents to avoid float precision issues
  ) {
    if (this.quantity < 0) {
      throw new Error("Opening balance quantity cannot be negative.");
    }
    if (this.unitCostCents < 0) {
      throw new Error("Unit cost cannot be negative.");
    }
  }
}
