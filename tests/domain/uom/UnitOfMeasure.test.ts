import { UnitOfMeasure } from "../../../src/domain/uom/valueObjects/UnitOfMeasure";
import { UomCategory } from "../../../src/domain/uom/enums/UomCategory";

describe("UnitOfMeasure", () => {
  it("should create a valid UnitOfMeasure", () => {
    const uom = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
    expect(uom.name).toBe("Case");
    expect(uom.abbreviation).toBe("cs");
    expect(uom.category).toBe(UomCategory.Discrete);
  });

  describe("Validation", () => {
    it("should throw an error if the name is empty", () => {
      expect(() => {
        new UnitOfMeasure("", "cs", UomCategory.Discrete);
      }).toThrow("UnitOfMeasure name and abbreviation must be non-empty.");
    });

    it("should throw an error if the name contains only whitespace", () => {
      expect(() => {
        new UnitOfMeasure("   ", "cs", UomCategory.Discrete);
      }).toThrow("UnitOfMeasure name and abbreviation must be non-empty.");
    });

    it("should throw an error if the abbreviation is empty", () => {
      expect(() => {
        new UnitOfMeasure("Case", "", UomCategory.Discrete);
      }).toThrow("UnitOfMeasure name and abbreviation must be non-empty.");
    });

    it("should throw an error if the abbreviation contains only whitespace", () => {
      expect(() => {
        new UnitOfMeasure("Case", "   ", UomCategory.Discrete);
      }).toThrow("UnitOfMeasure name and abbreviation must be non-empty.");
    });
  });
});
