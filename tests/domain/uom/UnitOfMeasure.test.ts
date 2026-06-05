import { UnitOfMeasure } from "../../../src/domain/uom/valueObjects/UnitOfMeasure";
import { UomCategory } from "../../../src/domain/uom/enums/UomCategory";

describe("UnitOfMeasure", () => {
  describe("constructor", () => {
    it("should instantiate successfully with valid inputs", () => {
      const uom = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
      expect(uom.name).toBe("Case");
      expect(uom.abbreviation).toBe("cs");
      expect(uom.category).toBe(UomCategory.Discrete);
    });

    it("should throw an error if the name is empty", () => {
      expect(() => {
        new UnitOfMeasure("", "cs", UomCategory.Discrete);
      }).toThrow("UnitOfMeasure name and abbreviation must be non-empty.");
    });

    it("should throw an error if the name is only whitespace", () => {
      expect(() => {
        new UnitOfMeasure("   ", "cs", UomCategory.Discrete);
      }).toThrow("UnitOfMeasure name and abbreviation must be non-empty.");
    });

    it("should throw an error if the abbreviation is empty", () => {
      expect(() => {
        new UnitOfMeasure("Case", "", UomCategory.Discrete);
      }).toThrow("UnitOfMeasure name and abbreviation must be non-empty.");
    });

    it("should throw an error if the abbreviation is only whitespace", () => {
      expect(() => {
        new UnitOfMeasure("Case", "   ", UomCategory.Discrete);
      }).toThrow("UnitOfMeasure name and abbreviation must be non-empty.");
    });

    it("should throw an error if both name and abbreviation are empty", () => {
      expect(() => {
        new UnitOfMeasure("", "", UomCategory.Discrete);
      }).toThrow("UnitOfMeasure name and abbreviation must be non-empty.");
    });
  });

  describe("equals", () => {
    it("should return true if name and category match, ignoring abbreviation differences", () => {
      const uom1 = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
      const uom2 = new UnitOfMeasure("Case", "CASE", UomCategory.Discrete);
      expect(uom1.equals(uom2)).toBe(true);
    });

    it("should return false if names do not match", () => {
      const uom1 = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
      const uom2 = new UnitOfMeasure("Each", "ea", UomCategory.Discrete);
      expect(uom1.equals(uom2)).toBe(false);
    });

    it("should return false if categories do not match", () => {
      const uom1 = new UnitOfMeasure("Custom", "ctm", UomCategory.Discrete);
      const uom2 = new UnitOfMeasure("Custom", "ctm", UomCategory.Weight);
      expect(uom1.equals(uom2)).toBe(false);
    });
  });

  describe("isCompatibleWith", () => {
    it("should return true if categories match", () => {
      const uom1 = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
      const uom2 = new UnitOfMeasure("Each", "ea", UomCategory.Discrete);
      expect(uom1.isCompatibleWith(uom2)).toBe(true);
    });

    it("should return false if categories do not match", () => {
      const uom1 = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
      const uom2 = new UnitOfMeasure("Gram", "g", UomCategory.Weight);
      expect(uom1.isCompatibleWith(uom2)).toBe(false);
    });
  });

  describe("toString", () => {
    it("should return string representation formatted as 'Name (abbreviation)'", () => {
      const uom = new UnitOfMeasure("Case", "cs", UomCategory.Discrete);
      expect(uom.toString()).toBe("Case (cs)");
    });
  });
});
