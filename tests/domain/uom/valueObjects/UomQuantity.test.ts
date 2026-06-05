import { UomQuantity } from "../../../../src/domain/uom/valueObjects/UomQuantity";
import { StandardUnits } from "../../../../src/domain/uom/services/StandardUnits";

describe("UomQuantity", () => {
  const each = StandardUnits.each();

  it("should create a UomQuantity with a valid positive amount", () => {
    const qty = new UomQuantity(10, each);
    expect(qty.amount).toBe(10);
    expect(qty.unit.equals(each)).toBe(true);
  });

  it("should throw an error when created with a negative amount", () => {
    expect(() => new UomQuantity(-5, each)).toThrow("Quantity amount cannot be negative.");
  });

  describe("add", () => {
    it("should add two quantities with the same unit", () => {
      const qty1 = new UomQuantity(10, each);
      const qty2 = new UomQuantity(5, each);
      const result = qty1.add(qty2);

      expect(result.amount).toBe(15);
      expect(result.unit.equals(each)).toBe(true);
    });
  });

  describe("subtract", () => {
    it("should subtract a smaller quantity from a larger one", () => {
      const qty1 = new UomQuantity(10, each);
      const qty2 = new UomQuantity(3, each);
      const result = qty1.subtract(qty2);

      expect(result.amount).toBe(7);
      expect(result.unit.equals(each)).toBe(true);
    });

    it("should allow subtracting an equal quantity to reach zero", () => {
      const qty1 = new UomQuantity(10, each);
      const qty2 = new UomQuantity(10, each);
      const result = qty1.subtract(qty2);

      expect(result.amount).toBe(0);
      expect(result.unit.equals(each)).toBe(true);
    });

    it("should throw an error when subtracting a larger quantity from a smaller one", () => {
      const qty1 = new UomQuantity(5, each);
      const qty2 = new UomQuantity(10, each);

      expect(() => qty1.subtract(qty2)).toThrow("Resulting quantity would be negative.");
    });
  });
});
