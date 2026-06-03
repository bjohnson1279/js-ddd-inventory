import { ProductUomConfiguration } from "../../../src/domain/uom/aggregates/ProductUomConfiguration";
import { StandardUnits } from "../../../src/domain/uom/services/StandardUnits";

describe("ProductUomConfiguration", () => {
  it("should throw an error when adding a conversion rule for the base unit", () => {
    const each = StandardUnits.each();
    const config = new ProductUomConfiguration("config-1", "variant-1", each);

    expect(() => {
      config.addConversionRule(each, 1);
    }).toThrow("Cannot add a conversion rule for the base unit itself.");
  });
});
