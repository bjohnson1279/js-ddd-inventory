import { InvalidQuantityException } from "../exceptions/InvalidQuantityException";
import { InsufficientStockException } from "../exceptions/InsufficientStockException";

export class Quantity {
  private readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  public static create(value: number): Quantity {
    if (!Number.isInteger(value)) {
      throw new InvalidQuantityException("Quantity must be an integer");
    }
    if (value < 0) {
      throw new InvalidQuantityException("Quantity cannot be negative");
    }
    return new Quantity(value);
  }

  public getValue(): number {
    return this.value;
  }

  public add(amount: Quantity): Quantity {
    return new Quantity(this.value + amount.getValue());
  }

  public subtract(amount: Quantity): Quantity {
    if (this.value < amount.getValue()) {
      throw new InsufficientStockException("Insufficient quantity");
    }
    return new Quantity(this.value - amount.getValue());
  }

  public equals(other: Quantity): boolean {
    return this.value === other.getValue();
  }
}
