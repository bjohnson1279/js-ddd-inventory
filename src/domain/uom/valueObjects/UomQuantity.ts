import { UnitOfMeasure } from "./UnitOfMeasure";
import { IncompatibleUnitsException } from "../exceptions/IncompatibleUnitsException";
import { UomCategory } from "../enums/UomCategory";

export class UomQuantity {
  constructor(
    public readonly amount: number,
    public readonly unit: UnitOfMeasure
  ) {
    if (this.amount < 0) {
      throw new Error("Quantity amount cannot be negative.");
    }
  }

  /**
   * Add two quantities of the SAME unit.
   * If you need to add across units, convert first via UomConverter.
   */
  public add(other: UomQuantity): UomQuantity {
    this.assertSameUnit(other);
    return new UomQuantity(this.amount + other.amount, this.unit);
  }

  public subtract(other: UomQuantity): UomQuantity {
    this.assertSameUnit(other);
    const result = this.amount - other.amount;
    if (result < 0) {
      throw new Error("Resulting quantity would be negative.");
    }
    return new UomQuantity(result, this.unit);
  }

  public multiplyBy(factor: number): UomQuantity {
    return new UomQuantity(this.amount * factor, this.unit);
  }

  /**
   * For ledger writes: discrete items must be whole numbers.
   * Continuous items (weight/volume) are stored as integer smallest-units
   * (grams, milliliters) to avoid float precision issues.
   */
  public toBaseInteger(): number {
    if (this.unit.category !== UomCategory.Discrete) {
      throw new Error(
        "Use toBaseInteger() only for discrete quantities. " +
          "Continuous quantities should be converted to their smallest unit (g, ml) first."
      );
    }

    if (this.amount % 1 !== 0) {
      throw new Error(
        `Discrete quantity must be a whole number; got ${this.amount} ${this.unit.abbreviation}.`
      );
    }

    return Math.floor(this.amount);
  }

  public toString(): string {
    return `${this.amount} ${this.unit.abbreviation}`;
  }

  private assertSameUnit(other: UomQuantity): void {
    if (!this.unit.equals(other.unit)) {
      throw new IncompatibleUnitsException(
        `Cannot operate on ${this.unit.name} and ${other.unit.name} directly. Convert first.`
      );
    }
  }
}
