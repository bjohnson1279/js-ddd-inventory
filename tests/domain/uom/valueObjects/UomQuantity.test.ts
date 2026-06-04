import { UomQuantity } from "../../../../src/domain/uom/valueObjects/UomQuantity";
import { UnitOfMeasure } from "../../../../src/domain/uom/valueObjects/UnitOfMeasure";
import { UomCategory } from "../../../../src/domain/uom/enums/UomCategory";

describe("UomQuantity", () => {
  const discreteUnit = new UnitOfMeasure("Each", "ea", UomCategory.Discrete);

  it("should create a valid UomQuantity with a positive amount", () => {
    const quantity = new UomQuantity(10, discreteUnit);
    expect(quantity.amount).toBe(10);
    expect(quantity.unit).toBe(discreteUnit);
  });

  it("should create a valid UomQuantity with an amount of zero", () => {
    const quantity = new UomQuantity(0, discreteUnit);
    expect(quantity.amount).toBe(0);
  });

  it("should throw an error when initialized with a negative amount", () => {
    expect(() => new UomQuantity(-5, discreteUnit)).toThrow(
      "Quantity amount cannot be negative."
    );
  });
});
