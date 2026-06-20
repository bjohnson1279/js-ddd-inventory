import { DomainException } from "./DomainException";

export class InsufficientAvailableStockException extends DomainException {
  constructor(
    public readonly sku: string,
    public readonly requested: number,
    public readonly available: number
  ) {
    super(
      `Insufficient available stock (ATP) for SKU ${sku}. Requested: ${requested}, Available: ${available}`
    );
    this.name = "InsufficientAvailableStockException";
  }
}
