import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InvalidSKUException } from "../../../src/domain/exceptions/InvalidSKUException";

describe("SKU Value Object", () => {
  it("should create a valid SKU and uppercase it", () => {
    const sku = SKU.create(" lap-123 ");
    expect(sku.getValue()).toBe("LAP-123");
  });

  it("should throw InvalidSKUException for empty SKU", () => {
    expect(() => SKU.create("")).toThrow(InvalidSKUException);
    expect(() => SKU.create("   ")).toThrow(InvalidSKUException);
  });

  it("should throw InvalidSKUException for SKU shorter than 3 characters", () => {
    expect(() => SKU.create("AB")).toThrow(InvalidSKUException);
  });

  it("should equal another SKU with the same value", () => {
    const sku1 = SKU.create("TEST1");
    const sku2 = SKU.create("test1");
    expect(sku1.equals(sku2)).toBe(true);
  });
});
