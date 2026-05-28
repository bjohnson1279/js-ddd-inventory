import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InvalidQuantityException } from "../../../src/domain/exceptions/InvalidQuantityException";
import { InsufficientStockException } from "../../../src/domain/exceptions/InsufficientStockException";

describe("Quantity Value Object", () => {
  it("should create a valid Quantity", () => {
    const qty = Quantity.create(10);
    expect(qty.getValue()).toBe(10);
  });

  it("should throw InvalidQuantityException for negative quantity", () => {
    expect(() => Quantity.create(-5)).toThrow(InvalidQuantityException);
  });

  it("should throw InvalidQuantityException for non-integers", () => {
    expect(() => Quantity.create(10.5)).toThrow(InvalidQuantityException);
  });

  it("should add two quantities", () => {
    const qty1 = Quantity.create(10);
    const qty2 = Quantity.create(5);
    const sum = qty1.add(qty2);
    expect(sum.getValue()).toBe(15);
  });

  it("should subtract quantities", () => {
    const qty1 = Quantity.create(10);
    const qty2 = Quantity.create(5);
    const result = qty1.subtract(qty2);
    expect(result.getValue()).toBe(5);
  });

  it("should throw InsufficientStockException when subtracting more than available", () => {
    const qty1 = Quantity.create(10);
    const qty2 = Quantity.create(15);
    expect(() => qty1.subtract(qty2)).toThrow(InsufficientStockException);
  });
});
