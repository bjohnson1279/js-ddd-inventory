import { VariantAttributeSet } from "../../../../src/domain/product/valueObjects/VariantAttributeSet";

describe("VariantAttributeSet", () => {
  describe("constructor", () => {
    it("should throw an error if attributes array is empty", () => {
      expect(() => {
        new VariantAttributeSet([]);
      }).toThrow("A variant must have at least one attribute.");
    });
  });
});
