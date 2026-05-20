import { StandardUnits } from "../../../src/domain/uom/services/StandardUnits";
import { UomConverter } from "../../../src/domain/uom/services/UomConverter";
import { ProductUomConfiguration } from "../../../src/domain/uom/aggregates/ProductUomConfiguration";
import { UomQuantity } from "../../../src/domain/uom/valueObjects/UomQuantity";
import { UnitOfMeasure } from "../../../src/domain/uom/valueObjects/UnitOfMeasure";
import { UomCategory } from "../../../src/domain/uom/enums/UomCategory";

describe("UomConverter", () => {
  const converter = new UomConverter();

  it("should convert within discrete units using rules", () => {
    const each = StandardUnits.each();
    const caseUnit = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
    
    const config = new ProductUomConfiguration("config-1", "variant-1", each);
    config.addConversionRule(caseUnit, 24);

    const quantityInCases = new UomQuantity(2, caseUnit);
    const convertedToEach = converter.toBaseUnit(quantityInCases, config);

    expect(convertedToEach.amount).toBe(48);
    expect(convertedToEach.unit.equals(each)).toBe(true);
  });

  it("should convert back from base unit to discrete unit", () => {
    const each = StandardUnits.each();
    const caseUnit = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
    
    const config = new ProductUomConfiguration("config-1", "variant-1", each);
    config.addConversionRule(caseUnit, 24);

    const quantityInEach = new UomQuantity(48, each);
    const convertedToCases = converter.convert(quantityInEach, caseUnit, config);

    expect(convertedToCases.amount).toBe(2);
    expect(convertedToCases.unit.equals(caseUnit)).toBe(true);
  });

  it("should convert weight units using standard factors", () => {
    const gram = StandardUnits.gram();
    const kilogram = StandardUnits.kilogram();
    
    const config = new ProductUomConfiguration("config-2", "variant-2", gram);

    const qtyInKg = new UomQuantity(1.5, kilogram);
    const inGrams = converter.toBaseUnit(qtyInKg, config);

    expect(inGrams.amount).toBe(1500);
  });

  it("should convert volume units using standard factors", () => {
    const ml = StandardUnits.milliliter();
    const liter = StandardUnits.liter();
    
    const config = new ProductUomConfiguration("config-3", "variant-3", ml);

    const qtyInLiters = new UomQuantity(2, liter);
    const inMl = converter.toBaseUnit(qtyInLiters, config);

    expect(inMl.amount).toBe(2000);
  });

  it("should throw error when converting incompatible units", () => {
    const each = StandardUnits.each();
    const gram = StandardUnits.gram();
    const config = new ProductUomConfiguration("config-4", "variant-4", each);

    const qty = new UomQuantity(10, gram);
    
    expect(() => converter.toBaseUnit(qty, config)).toThrow();
  });

  it("should convert cost correctly", () => {
    const each = StandardUnits.each();
    const caseUnit = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
    const config = new ProductUomConfiguration("config-5", "variant-5", each);
    config.addConversionRule(caseUnit, 24);

    // $24.00 per case should be $1.00 per each
    const costPerEach = converter.convertCost(2400, caseUnit, each, config);
    expect(costPerEach).toBe(100);

    // $0.50 per each should be $12.00 per case
    const costPerCase = converter.convertCost(50, each, caseUnit, config);
    expect(costPerCase).toBe(1200);
  });
});
