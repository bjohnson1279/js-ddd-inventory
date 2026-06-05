import { ProductUomConfiguration } from "../../../src/domain/uom/aggregates/ProductUomConfiguration";
import { StandardUnits } from "../../../src/domain/uom/services/StandardUnits";
import { IncompatibleUnitsException } from "../../../src/domain/uom/exceptions/IncompatibleUnitsException";

describe("ProductUomConfiguration", () => {
  describe("addConversionRule", () => {
    it("should throw IncompatibleUnitsException when adding a rule with a unit of a different category", () => {
      // Instantiate configuration with a Weight base unit (gram)
      const baseUnitWeight = StandardUnits.gram();
      const config = new ProductUomConfiguration("config-1", "variant-1", baseUnitWeight);

      // Attempt to add a rule for a Volume unit (milliliter)
      const incompatibleUnitVolume = StandardUnits.milliliter();

      // Ensure it throws the specific IncompatibleUnitsException
      expect(() => {
        config.addConversionRule(incompatibleUnitVolume, 10);
      }).toThrow(IncompatibleUnitsException);

      expect(() => {
        config.addConversionRule(incompatibleUnitVolume, 10);
      }).toThrow("Cannot convert between volume and weight units.");
    });
  });
});
