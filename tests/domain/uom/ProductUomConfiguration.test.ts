import { ProductUomConfiguration } from "../../../src/domain/uom/aggregates/ProductUomConfiguration";
import { StandardUnits } from "../../../src/domain/uom/services/StandardUnits";
import { IncompatibleUnitsException } from "../../../src/domain/uom/exceptions/IncompatibleUnitsException";

describe("ProductUomConfiguration", () => {
  describe("addConversionRule", () => {
    it("should throw IncompatibleUnitsException when adding a conversion rule for an incompatible unit", () => {
      const gram = StandardUnits.gram();
      const config = new ProductUomConfiguration("config-1", "variant-1", gram);

      const milliliter = StandardUnits.milliliter();

      expect(() => {
        config.addConversionRule(milliliter, 1, "ml to g");
      }).toThrow(IncompatibleUnitsException);

      expect(() => {
        config.addConversionRule(milliliter, 1, "ml to g");
      }).toThrow(`Cannot convert between ${milliliter.category} and ${gram.category} units.`);
    });
  });
});
