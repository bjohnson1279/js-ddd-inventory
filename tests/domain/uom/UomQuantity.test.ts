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
  });
});
