import { UomQuantity } from "../../../src/domain/uom/valueObjects/UomQuantity";
import { StandardUnits } from "../../../src/domain/uom/services/StandardUnits";

describe("UomQuantity", () => {
  describe("toBaseInteger", () => {
    it("should return the correct integer for a valid, whole discrete quantity", () => {
      const each = StandardUnits.each();
      const quantity = new UomQuantity(5, each);
      expect(quantity.toBaseInteger()).toBe(5);
    });

    it("should throw an error when called on a continuous quantity (Weight)", () => {
      const gram = StandardUnits.gram();
      const quantity = new UomQuantity(10.5, gram);
      expect(() => quantity.toBaseInteger()).toThrow(
        "Use toBaseInteger() only for discrete quantities. Continuous quantities should be converted to their smallest unit (g, ml) first."
      );
    });

    it("should throw an error when called on a continuous quantity (Volume)", () => {
      const liter = StandardUnits.liter();
      const quantity = new UomQuantity(2, liter);
      expect(() => quantity.toBaseInteger()).toThrow(
        "Use toBaseInteger() only for discrete quantities. Continuous quantities should be converted to their smallest unit (g, ml) first."
      );
    });

    it("should throw an error when called on a fractional discrete quantity", () => {
      const each = StandardUnits.each();
      const quantity = new UomQuantity(2.5, each);
      expect(() => quantity.toBaseInteger()).toThrow(
        `Discrete quantity must be a whole number; got 2.5 ea.`
      );
    });
  });
});
