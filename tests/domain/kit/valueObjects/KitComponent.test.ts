import { KitComponent } from "../../../../src/domain/kit/valueObjects/KitComponent";

describe("KitComponent", () => {
  it("should create a KitComponent successfully with valid quantity", () => {
    const component = new KitComponent("variant-123", 5);

    expect(component.variantId).toBe("variant-123");
    expect(component.quantity).toBe(5);
  });

  it("should create a KitComponent successfully with minimum quantity of 1", () => {
    const component = new KitComponent("variant-123", 1);

    expect(component.variantId).toBe("variant-123");
    expect(component.quantity).toBe(1);
  });

  it("should throw an Error if quantity is 0", () => {
    expect(() => {
      new KitComponent("variant-123", 0);
    }).toThrow("Kit component quantity must be at least 1.");
  });

  it("should throw an Error if quantity is negative", () => {
    expect(() => {
      new KitComponent("variant-123", -5);
    }).toThrow("Kit component quantity must be at least 1.");
  });
});
