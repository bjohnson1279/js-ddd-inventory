import { ConversionRule } from "../../../../src/domain/uom/entities/ConversionRule";
import { UnitOfMeasure } from "../../../../src/domain/uom/valueObjects/UnitOfMeasure";
import { UomCategory } from "../../../../src/domain/uom/enums/UomCategory";

describe("ConversionRule", () => {
  const discreteUnit = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);

  it("should create a valid ConversionRule", () => {
    const rule = new ConversionRule("rule-1", discreteUnit, 24, "Case of 24");
    expect(rule.id).toBe("rule-1");
    expect(rule.unit.equals(discreteUnit)).toBe(true);
    expect(rule.factorToBase).toBe(24);
    expect(rule.label).toBe("Case of 24");
  });

  it("should throw an error if factorToBase is empty (NaN)", () => {
    expect(() => new ConversionRule("rule-1", discreteUnit, NaN)).toThrow(
      "Conversion factor must be positive; got NaN."
    );
  });

  it("should throw an error if factorToBase is negative", () => {
    expect(() => new ConversionRule("rule-1", discreteUnit, -1)).toThrow(
      "Conversion factor must be positive; got -1."
    );
  });

  it("should throw an error if factorToBase is zero", () => {
    expect(() => new ConversionRule("rule-1", discreteUnit, 0)).toThrow(
      "Conversion factor must be positive; got 0."
    );
  });

  it("should throw an error if factorToBase is 1.0", () => {
    expect(() => new ConversionRule("rule-1", discreteUnit, 1.0)).toThrow(
      "A conversion factor of 1.0 would duplicate the base unit. Only add rules for units that differ from the base."
    );
  });

  it("should return the correct factorFromBase", () => {
    const rule = new ConversionRule("rule-1", discreteUnit, 24);
    expect(rule.factorFromBase()).toBeCloseTo(1 / 24, 5);
  });
});
