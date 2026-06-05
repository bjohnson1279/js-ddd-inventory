import { ConversionRule } from "../../../../src/domain/uom/entities/ConversionRule";
import { UnitOfMeasure } from "../../../../src/domain/uom/valueObjects/UnitOfMeasure";
import { UomCategory } from "../../../../src/domain/uom/enums/UomCategory";

describe("ConversionRule", () => {
  const testUnit = new UnitOfMeasure("Box", "bx", UomCategory.Discrete);

  it("should create a valid conversion rule", () => {
    const rule = new ConversionRule("rule-1", testUnit, 10);
    expect(rule.id).toBe("rule-1");
    expect(rule.unit).toBe(testUnit);
    expect(rule.factorToBase).toBe(10);
    expect(rule.label).toBeNull();
  });

  it("should create a valid conversion rule with a label", () => {
    const rule = new ConversionRule("rule-1", testUnit, 10, "Box of 10");
    expect(rule.label).toBe("Box of 10");
  });

  it("should return the correct factorFromBase", () => {
    const rule = new ConversionRule("rule-1", testUnit, 10);
    expect(rule.factorFromBase()).toBe(0.1);
  });

  it("should throw an error if factorToBase is negative", () => {
    expect(() => new ConversionRule("rule-1", testUnit, -5)).toThrowError(
      "Conversion factor must be positive; got -5."
    );
  });

  it("should throw an error if factorToBase is zero", () => {
    expect(() => new ConversionRule("rule-1", testUnit, 0)).toThrowError(
      "Conversion factor must be positive; got 0."
    );
  });

  it("should throw an error if factorToBase is 1.0", () => {
    expect(() => new ConversionRule("rule-1", testUnit, 1.0)).toThrowError(
      "A conversion factor of 1.0 would duplicate the base unit. Only add rules for units that differ from the base."
    );
  });
});
