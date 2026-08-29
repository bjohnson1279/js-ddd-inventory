export class ChannelAllocationPool {
  constructor(
    public readonly id: string,
    public readonly channelId: string,
    public readonly variantId: string,
    private _allocatedQuantity: number
  ) {}

  get allocatedQuantity(): number {
    return this._allocatedQuantity;
  }

  allocate(quantity: number): void {
    if (quantity < 0) throw new Error("Cannot allocate negative quantity");
    this._allocatedQuantity += quantity;
  }

  deallocate(quantity: number): void {
    if (quantity < 0) throw new Error("Cannot deallocate negative quantity");
    if (this._allocatedQuantity < quantity) {
      throw new Error(`Insufficient allocated quantity to deallocate ${quantity} (current: ${this._allocatedQuantity})`);
    }
    this._allocatedQuantity -= quantity;
  }
}
