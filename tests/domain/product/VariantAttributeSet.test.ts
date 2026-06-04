import { VariantAttributeSet } from "../../../src/domain/product/valueObjects/VariantAttributeSet";
import { VariantAttribute } from "../../../src/domain/product/valueObjects/VariantAttribute";

describe("VariantAttributeSet", () => {
  it("should create a VariantAttributeSet and sort attributes by name", () => {
    const attr1 = new VariantAttribute("size", "Large");
    const attr2 = new VariantAttribute("color", "Red");

    const set = new VariantAttributeSet([attr1, attr2]);

    const allAttributes = set.all();
    expect(allAttributes.length).toBe(2);
    // 'color' comes before 'size' alphabetically
    expect(allAttributes[0].name).toBe("color");
    expect(allAttributes[0].value).toBe("Red");
    expect(allAttributes[1].name).toBe("size");
    expect(allAttributes[1].value).toBe("Large");
  });

  it("should throw an error when initialized with an empty array", () => {
    expect(() => {
      new VariantAttributeSet([]);
    }).toThrow("A variant must have at least one attribute.");
  });

  it("should throw an error when initialized with null or undefined", () => {
    expect(() => {
      new VariantAttributeSet(null as any);
    }).toThrow("A variant must have at least one attribute.");

    expect(() => {
      new VariantAttributeSet(undefined as any);
    }).toThrow("A variant must have at least one attribute.");
  });

  it("should correctly compare two equal VariantAttributeSets", () => {
    const set1 = new VariantAttributeSet([
      new VariantAttribute("size", "Large"),
      new VariantAttribute("color", "Red")
    ]);

    const set2 = new VariantAttributeSet([
      new VariantAttribute("color", "Red"),
      new VariantAttribute("size", "Large")
    ]);

    expect(set1.equals(set2)).toBe(true);
  });

  it("should correctly compare two unequal VariantAttributeSets", () => {
    const set1 = new VariantAttributeSet([
      new VariantAttribute("size", "Large"),
      new VariantAttribute("color", "Red")
    ]);

    const set2 = new VariantAttributeSet([
      new VariantAttribute("size", "Medium"),
      new VariantAttribute("color", "Red")
    ]);

    const set3 = new VariantAttributeSet([
      new VariantAttribute("color", "Red")
    ]);

    expect(set1.equals(set2)).toBe(false);
    expect(set1.equals(set3)).toBe(false);
  });

  it("should return attributes mapped to plain objects with toArray", () => {
    const set = new VariantAttributeSet([
      new VariantAttribute("size", "Large"),
      new VariantAttribute("color", "Red")
    ]);

    const arr = set.toArray();
    expect(arr).toEqual([
      { name: "color", value: "Red" },
      { name: "size", value: "Large" }
    ]);
  });
});
