import { UomQuantity } from "../../../src/domain/uom/valueObjects/UomQuantity";
import { UnitOfMeasure } from "../../../src/domain/uom/valueObjects/UnitOfMeasure";
import { UomCategory } from "../../../src/domain/uom/enums/UomCategory";

describe("UomQuantity Value Object", () => {
  const dummyUnit = new UnitOfMeasure("Each", "ea", UomCategory.Discrete);

  it("should create a valid UomQuantity", () => {
    const qty = new UomQuantity(10, dummyUnit);
    expect(qty.amount).toBe(10);
    expect(qty.unit).toBe(dummyUnit);
  });

  it("should throw an error for negative amount", () => {
    expect(() => new UomQuantity(-5, dummyUnit)).toThrow("Quantity amount cannot be negative.");
  });

  it("should add two quantities of the same unit", () => {
    const qty1 = new UomQuantity(10, dummyUnit);
    const qty2 = new UomQuantity(5, dummyUnit);
    const sum = qty1.add(qty2);
    expect(sum.amount).toBe(15);
    expect(sum.unit).toBe(dummyUnit);
  });

  it("should subtract quantities of the same unit", () => {
    const qty1 = new UomQuantity(10, dummyUnit);
    const qty2 = new UomQuantity(5, dummyUnit);
    const result = qty1.subtract(qty2);
    expect(result.amount).toBe(5);
    expect(result.unit).toBe(dummyUnit);
  });

  it("should throw an error when subtracting a larger quantity from a smaller one", () => {
    const qty1 = new UomQuantity(5, dummyUnit);
    const qty2 = new UomQuantity(10, dummyUnit);
    expect(() => qty1.subtract(qty2)).toThrow("Resulting quantity would be negative.");
describe("UomQuantity", () => {
  const discreteUnit = new UnitOfMeasure("Each", "ea", UomCategory.Discrete);
  const continuousUnit = new UnitOfMeasure("Gram", "g", UomCategory.Weight);

  describe("Constructor", () => {
    it("should create a quantity with a valid positive amount", () => {
      const qty = new UomQuantity(10, discreteUnit);
      expect(qty.amount).toBe(10);
      expect(qty.unit).toBe(discreteUnit);
    });

    it("should throw an error for negative amounts", () => {
      expect(() => new UomQuantity(-5, discreteUnit)).toThrow(
        "Quantity amount cannot be negative."
      );
    });
  });

  describe("add", () => {
    it("should add two quantities of the same unit", () => {
      const qty1 = new UomQuantity(5, discreteUnit);
      const qty2 = new UomQuantity(3, discreteUnit);
      const result = qty1.add(qty2);
      expect(result.amount).toBe(8);
      expect(result.unit).toBe(discreteUnit);
    });

    it("should throw an error when adding different units directly", () => {
      const qty1 = new UomQuantity(5, discreteUnit);
      const otherUnit = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
      const qty2 = new UomQuantity(3, otherUnit);
      expect(() => qty1.add(qty2)).toThrow();
    });
  });

  describe("subtract", () => {
    it("should subtract two quantities of the same unit", () => {
      const qty1 = new UomQuantity(5, discreteUnit);
      const qty2 = new UomQuantity(3, discreteUnit);
      const result = qty1.subtract(qty2);
      expect(result.amount).toBe(2);
      expect(result.unit).toBe(discreteUnit);
    });

    it("should throw an error if the resulting quantity would be negative", () => {
      const qty1 = new UomQuantity(3, discreteUnit);
      const qty2 = new UomQuantity(5, discreteUnit);
      expect(() => qty1.subtract(qty2)).toThrow("Resulting quantity would be negative.");
    });
  });

  describe("multiplyBy", () => {
    it("should multiply the quantity by a given factor", () => {
      const qty = new UomQuantity(5, discreteUnit);
      const result = qty.multiplyBy(3);
      expect(result.amount).toBe(15);
      expect(result.unit).toBe(discreteUnit);
    });
  });

  describe("toBaseInteger", () => {
    it("should return the amount for a whole discrete quantity", () => {
      const qty = new UomQuantity(5, discreteUnit);
      expect(qty.toBaseInteger()).toBe(5);
    });

    it("should throw an error when called on a continuous quantity", () => {
      const qty = new UomQuantity(5.5, continuousUnit);
      expect(() => qty.toBaseInteger()).toThrow(
        "Use toBaseInteger() only for discrete quantities. Continuous quantities should be converted to their smallest unit (g, ml) first."
      );
    });

    it("should throw an error for a non-whole discrete quantity", () => {
      const qty = new UomQuantity(1.5, discreteUnit);
      expect(() => qty.toBaseInteger()).toThrow(
        "Discrete quantity must be a whole number; got 1.5 ea."
      );
    });
  });
});
