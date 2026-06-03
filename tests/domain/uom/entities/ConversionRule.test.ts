import { ConversionRule } from "../../../../src/domain/uom/entities/ConversionRule";
import { UnitOfMeasure } from "../../../../src/domain/uom/valueObjects/UnitOfMeasure";
import { UomCategory } from "../../../../src/domain/uom/enums/UomCategory";

describe("ConversionRule", () => {
  const caseUnit = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);

  it("should create a ConversionRule successfully", () => {
    const rule = new ConversionRule("rule-1", caseUnit, 24, "Case of 24");
    expect(rule.id).toBe("rule-1");
    expect(rule.unit.equals(caseUnit)).toBe(true);
    expect(rule.factorToBase).toBe(24);
    expect(rule.label).toBe("Case of 24");
  });

  it("should throw an error if factorToBase is negative", () => {
    expect(() => {
      new ConversionRule("rule-2", caseUnit, -5);
    }).toThrow("Conversion factor must be positive; got -5.");
  });

  it("should throw an error if factorToBase is zero", () => {
    expect(() => {
      new ConversionRule("rule-3", caseUnit, 0);
    }).toThrow("Conversion factor must be positive; got 0.");
  });

  it("should throw an error if factorToBase is 1.0", () => {
    expect(() => {
      new ConversionRule("rule-4", caseUnit, 1.0);
    }).toThrow(
      "A conversion factor of 1.0 would duplicate the base unit. " +
        "Only add rules for units that differ from the base."
    );
  });

  it("should calculate factorFromBase correctly", () => {
    const rule = new ConversionRule("rule-5", caseUnit, 24);
    expect(rule.factorFromBase()).toBe(1.0 / 24);
  });
});
