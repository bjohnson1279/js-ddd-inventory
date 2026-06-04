import { UomQuantity } from "../../../../src/domain/uom/valueObjects/UomQuantity";
import { UnitOfMeasure } from "../../../../src/domain/uom/valueObjects/UnitOfMeasure";
import { UomCategory } from "../../../../src/domain/uom/enums/UomCategory";
import { IncompatibleUnitsException } from "../../../../src/domain/uom/exceptions/IncompatibleUnitsException";

describe("UomQuantity Value Object", () => {
  const discreteUnit = new UnitOfMeasure("Each", "ea", UomCategory.Discrete);
  const continuousUnit = new UnitOfMeasure("Gram", "g", UomCategory.Weight);

  it("should create a valid UomQuantity", () => {
    const qty = new UomQuantity(10, discreteUnit);
    expect(qty.amount).toBe(10);
    expect(qty.unit.equals(discreteUnit)).toBe(true);
  });

  it("should throw an error for negative amount", () => {
    expect(() => new UomQuantity(-5, discreteUnit)).toThrow("Quantity amount cannot be negative.");
  });

  it("should add two quantities of the same unit", () => {
    const qty1 = new UomQuantity(10, discreteUnit);
    const qty2 = new UomQuantity(5, discreteUnit);
    const sum = qty1.add(qty2);
    expect(sum.amount).toBe(15);
  });

  it("should throw IncompatibleUnitsException when adding different units", () => {
    const qty1 = new UomQuantity(10, discreteUnit);
    const qty2 = new UomQuantity(5, continuousUnit);
    expect(() => qty1.add(qty2)).toThrow(IncompatibleUnitsException);
  });

  it("should subtract quantities of the same unit", () => {
    const qty1 = new UomQuantity(10, discreteUnit);
    const qty2 = new UomQuantity(5, discreteUnit);
    const result = qty1.subtract(qty2);
    expect(result.amount).toBe(5);
  });

  it("should throw an error when resulting quantity would be negative", () => {
    const qty1 = new UomQuantity(5, discreteUnit);
    const qty2 = new UomQuantity(10, discreteUnit);
    expect(() => qty1.subtract(qty2)).toThrow("Resulting quantity would be negative.");
  });

  it("should multiply quantity by a factor", () => {
    const qty = new UomQuantity(10, discreteUnit);
    const result = qty.multiplyBy(2.5);
    expect(result.amount).toBe(25);
  });

  describe("toBaseInteger()", () => {
    it("should return the base integer for a whole discrete quantity", () => {
      const qty = new UomQuantity(10, discreteUnit);
      expect(qty.toBaseInteger()).toBe(10);
    });

    it("should throw an error when called on a non-discrete quantity", () => {
      const qty = new UomQuantity(10, continuousUnit);
      expect(() => qty.toBaseInteger()).toThrow(
        "Use toBaseInteger() only for discrete quantities. Continuous quantities should be converted to their smallest unit (g, ml) first."
      );
    });

    it("should throw an error for non-whole discrete quantities", () => {
      const qty = new UomQuantity(10.5, discreteUnit);
      expect(() => qty.toBaseInteger()).toThrow(
        "Discrete quantity must be a whole number; got 10.5 ea."
      );
    });
  });

  it("should convert to string representation", () => {
    const qty = new UomQuantity(10, discreteUnit);
    expect(qty.toString()).toBe("10 ea");
  });
});
