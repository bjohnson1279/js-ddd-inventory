import { VariantAttribute } from "../../../../src/domain/product/valueObjects/VariantAttribute";
import { VariantAttributeSet } from "../../../../src/domain/product/valueObjects/VariantAttributeSet";

describe("VariantAttributeSet", () => {
  describe("constructor", () => {
    it("should throw an error if initialized with an empty array", () => {
      expect(() => new VariantAttributeSet([])).toThrow(
        "A variant must have at least one attribute."
      );
    });

    it("should throw an error if initialized with null", () => {
      expect(() => new VariantAttributeSet(null as any)).toThrow(
        "A variant must have at least one attribute."
      );
    });

    it("should throw an error if initialized with undefined", () => {
      expect(() => new VariantAttributeSet(undefined as any)).toThrow(
        "A variant must have at least one attribute."
      );
    });

    it("should initialize and sort attributes by name", () => {
      const attr1 = new VariantAttribute("Size", "Large");
      const attr2 = new VariantAttribute("Color", "Red");
      const set = new VariantAttributeSet([attr1, attr2]);

      const allAttributes = set.all();
      expect(allAttributes.length).toBe(2);
      expect(allAttributes[0].name).toBe("Color");
      expect(allAttributes[1].name).toBe("Size");
    });
  });

  describe("equals", () => {
    it("should return true for sets with the same attributes in any order", () => {
      const attr1 = new VariantAttribute("Size", "Large");
      const attr2 = new VariantAttribute("Color", "Red");
      const set1 = new VariantAttributeSet([attr1, attr2]);
      const set2 = new VariantAttributeSet([attr2, attr1]);

      expect(set1.equals(set2)).toBe(true);
    });

    it("should return false for sets with different numbers of attributes", () => {
      const attr1 = new VariantAttribute("Size", "Large");
      const attr2 = new VariantAttribute("Color", "Red");
      const set1 = new VariantAttributeSet([attr1, attr2]);
      const set2 = new VariantAttributeSet([attr1]);

      expect(set1.equals(set2)).toBe(false);
    });

    it("should return false for sets with different attribute values", () => {
      const attr1 = new VariantAttribute("Size", "Large");
      const attr2 = new VariantAttribute("Color", "Red");
      const attr3 = new VariantAttribute("Color", "Blue");
      const set1 = new VariantAttributeSet([attr1, attr2]);
      const set2 = new VariantAttributeSet([attr1, attr3]);

      expect(set1.equals(set2)).toBe(false);
    });
  });

  describe("all", () => {
    it("should return a copy of the attributes array", () => {
      const attr1 = new VariantAttribute("Size", "Large");
      const set = new VariantAttributeSet([attr1]);

      const attributes = set.all();
      expect(attributes).toEqual([attr1]);

      // Ensure it's a copy
      attributes.push(new VariantAttribute("Color", "Red"));
      expect(set.all().length).toBe(1);
    });
  });

  describe("toArray", () => {
    it("should map attributes to plain objects", () => {
      const attr1 = new VariantAttribute("Size", "Large");
      const attr2 = new VariantAttribute("Color", "Red");
      const set = new VariantAttributeSet([attr1, attr2]);

      const array = set.toArray();
      expect(array).toEqual([
        { name: "Color", value: "Red" },
        { name: "Size", value: "Large" },
      ]);
    });
  });
});
