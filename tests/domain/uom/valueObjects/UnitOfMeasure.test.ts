import { UnitOfMeasure } from "../../../../src/domain/uom/valueObjects/UnitOfMeasure";
import { UomCategory } from "../../../../src/domain/uom/enums/UomCategory";

describe("UnitOfMeasure Value Object", () => {
  it("should create a valid UnitOfMeasure", () => {
    const uom = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
    expect(uom.name).toBe("Case");
    expect(uom.abbreviation).toBe("cs");
    expect(uom.category).toBe(UomCategory.Discrete);
  });

  it("should throw an error for empty name", () => {
    expect(() => new UnitOfMeasure("", "cs", UomCategory.Discrete)).toThrow("UnitOfMeasure name and abbreviation must be non-empty.");
    expect(() => new UnitOfMeasure("   ", "cs", UomCategory.Discrete)).toThrow("UnitOfMeasure name and abbreviation must be non-empty.");
  });

  it("should throw an error for empty abbreviation", () => {
    expect(() => new UnitOfMeasure("Case", "", UomCategory.Discrete)).toThrow("UnitOfMeasure name and abbreviation must be non-empty.");
    expect(() => new UnitOfMeasure("Case", "  ", UomCategory.Discrete)).toThrow("UnitOfMeasure name and abbreviation must be non-empty.");
  });

  it("should return true for equals when name and category match", () => {
    const uom1 = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
    const uom2 = new UnitOfMeasure("Case", "c", UomCategory.Discrete); // different abbreviation
    expect(uom1.equals(uom2)).toBe(true);
  });

  it("should return false for equals when name or category mismatch", () => {
    const uom1 = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
    const uom2 = new UnitOfMeasure("Box", "cs", UomCategory.Discrete);
    const uom3 = new UnitOfMeasure("Case", "cs", UomCategory.Weight);
    expect(uom1.equals(uom2)).toBe(false);
    expect(uom1.equals(uom3)).toBe(false);
  });

  it("should return true for isCompatibleWith when category matches", () => {
    const uom1 = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
    const uom2 = new UnitOfMeasure("Each", "ea", UomCategory.Discrete);
    expect(uom1.isCompatibleWith(uom2)).toBe(true);
  });

  it("should return false for isCompatibleWith when category mismatches", () => {
    const uom1 = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
    const uom2 = new UnitOfMeasure("Gram", "g", UomCategory.Weight);
    expect(uom1.isCompatibleWith(uom2)).toBe(false);
  });

  it("should return true for isCompatibleWith when comparing the same instance", () => {
    const uom = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
    expect(uom.isCompatibleWith(uom)).toBe(true);
  });

  it("should return correct string representation", () => {
    const uom = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
    expect(uom.toString()).toBe("Case (cs)");
  });
});
