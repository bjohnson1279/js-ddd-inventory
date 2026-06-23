import { Kit } from "../../../../src/domain/kit/aggregates/Kit";
import { SKU } from "../../../../src/domain/valueObjects/SKU";

describe("Kit", () => {
  let sku: SKU;

  beforeEach(() => {
    sku = SKU.create("KIT-123");
  });

  it("should create an empty kit", () => {
    const kit = new Kit("kit-1", sku, "Test Kit");
    expect(kit.id).toBe("kit-1");
    expect(kit.sku).toBe(sku);
    expect(kit.name).toBe("Test Kit");
    expect(kit.isEmpty()).toBe(true);
    expect(kit.components).toEqual([]);
  });

  it("should add a new component", () => {
    const kit = new Kit("kit-1", sku, "Test Kit");
    kit.addComponent("variant-1", 2);

    expect(kit.isEmpty()).toBe(false);
    expect(kit.components.length).toBe(1);
    expect(kit.components[0].variantId).toBe("variant-1");
    expect(kit.components[0].quantity).toBe(2);
  });

  it("should increase quantity when adding an existing component", () => {
    const kit = new Kit("kit-1", sku, "Test Kit");
    kit.addComponent("variant-1", 2);
    kit.addComponent("variant-1", 3);

    expect(kit.components.length).toBe(1);
    expect(kit.components[0].variantId).toBe("variant-1");
    expect(kit.components[0].quantity).toBe(5);
  });

  it("should return a copy of components to prevent external mutation", () => {
    const kit = new Kit("kit-1", sku, "Test Kit");
    kit.addComponent("variant-1", 2);

    const components = kit.components;
    components.push({ variantId: "variant-2", quantity: 1 } as any);

    expect(kit.components.length).toBe(1);
  });

  it("should throw when adding a component with quantity < 1", () => {
    const kit = new Kit("kit-1", sku, "Test Kit");
    expect(() => kit.addComponent("variant-1", 0)).toThrow();
  });
});
