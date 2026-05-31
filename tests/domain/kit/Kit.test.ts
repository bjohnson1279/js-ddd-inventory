import { Kit } from "../../../src/domain/kit/aggregates/Kit";
import { SKU } from "../../../src/domain/valueObjects/SKU";

describe("Kit Aggregate", () => {
  it("should initialize empty kit", () => {
    const kit = new Kit("KIT-1", SKU.create("BUNDLE-STARTER"), "Starter Kit");
    expect(kit.isEmpty()).toBe(true);
    expect(kit.components.length).toBe(0);
  });

  it("should add components and merge quantities", () => {
    const kit = new Kit("KIT-1", SKU.create("BUNDLE-STARTER"), "Starter Kit");

    kit.addComponent("VAR-RED-SM", 2);
    expect(kit.isEmpty()).toBe(false);
    expect(kit.components.length).toBe(1);
    expect(kit.components[0].variantId).toBe("VAR-RED-SM");
    expect(kit.components[0].quantity).toBe(2);

    // Merge quantity if added again
    kit.addComponent("VAR-RED-SM", 3);
    expect(kit.components.length).toBe(1);
    expect(kit.components[0].quantity).toBe(5);
  });
});
