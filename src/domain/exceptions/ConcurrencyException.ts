import { DomainException } from "./DomainException";

export class ConcurrencyException extends DomainException {
  constructor(
    public readonly sku: string,
    public readonly locationId: string
  ) {
    super(
      `Concurrency error: Item with SKU ${sku} at location ${locationId} was modified by another process.`
    );
    this.name = "ConcurrencyException";
  }
}
