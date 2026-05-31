import { DomainException } from "./DomainException";

export class InsufficientInventoryException extends DomainException {
  constructor(
    public readonly variantId: string,
    public readonly available: number,
    public readonly requested: number
  ) {
    super(
      `Insufficient stock for variant ${variantId}. Available: ${available}, Requested: ${requested}.`
    );
    this.name = "InsufficientInventoryException";
  }
}
