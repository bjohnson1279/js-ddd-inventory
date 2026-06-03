import { UomQuantity } from "../../../../src/domain/uom/valueObjects/UomQuantity";
import { UnitOfMeasure } from "../../../../src/domain/uom/valueObjects/UnitOfMeasure";
import { UomCategory } from "../../../../src/domain/uom/enums/UomCategory";

describe("UomQuantity", () => {
  const discreteUnit = new UnitOfMeasure("Each", "ea", UomCategory.Discrete);
  const continuousUnit = new UnitOfMeasure("Gram", "g", UomCategory.Weight);

  it("should return the base integer for a discrete unit", () => {
    const qty = new UomQuantity(5, discreteUnit);
    expect(qty.toBaseInteger()).toBe(5);
  });

  it("should throw an error if a discrete unit is not an integer", () => {
    const qty = new UomQuantity(5.5, discreteUnit);
    expect(() => qty.toBaseInteger()).toThrow(
      "Discrete quantity must be a whole number; got 5.5 ea."
    );
  });

  it("should throw an error when calling toBaseInteger on continuous quantities", () => {
    const qty = new UomQuantity(100, continuousUnit);
    expect(() => qty.toBaseInteger()).toThrow(
      "Use toBaseInteger() only for discrete quantities. Continuous quantities should be converted to their smallest unit (g, ml) first."
    );
  });
});
