import { UomQuantity } from "../../../src/domain/uom/valueObjects/UomQuantity";
import { StandardUnits } from "../../../src/domain/uom/services/StandardUnits";

describe("UomQuantity Value Object", () => {
  it("should create a valid UomQuantity", () => {
    const each = StandardUnits.each();
    const qty = new UomQuantity(10, each);
    expect(qty.amount).toBe(10);
    expect(qty.unit.equals(each)).toBe(true);
  });

  it("should throw an error for negative quantity", () => {
    const each = StandardUnits.each();
    expect(() => new UomQuantity(-5, each)).toThrow("Quantity amount cannot be negative.");
  });

  it("should add two quantities of the same unit", () => {
    const each = StandardUnits.each();
    const qty1 = new UomQuantity(10, each);
    const qty2 = new UomQuantity(5, each);
    const sum = qty1.add(qty2);
    expect(sum.amount).toBe(15);
    expect(sum.unit.equals(each)).toBe(true);
  });

  it("should subtract quantities of the same unit", () => {
    const each = StandardUnits.each();
    const qty1 = new UomQuantity(10, each);
    const qty2 = new UomQuantity(5, each);
    const result = qty1.subtract(qty2);
    expect(result.amount).toBe(5);
    expect(result.unit.equals(each)).toBe(true);
  });

  it("should throw an error when subtracting more than available", () => {
    const each = StandardUnits.each();
    const qty1 = new UomQuantity(10, each);
    const qty2 = new UomQuantity(15, each);
    expect(() => qty1.subtract(qty2)).toThrow("Resulting quantity would be negative.");
  });
});
