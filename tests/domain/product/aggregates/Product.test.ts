import { Product } from "../../../../src/domain/product/aggregates/Product";
import { VariantAttribute } from "../../../../src/domain/product/valueObjects/VariantAttribute";
import { SKU } from "../../../../src/domain/valueObjects/SKU";
import { DuplicateVariantException } from "../../../../src/domain/product/exceptions/DuplicateVariantException";

describe("Product and Variant Domain", () => {
  it("should initialize product with basic properties and no variants", () => {
    const product = new Product("PROD-1", "Classic Tee");
    expect(product.id).toBe("PROD-1");
    expect(product.name).toBe("Classic Tee");
    expect(product.variants).toEqual([]);
  });

  it("should add variants to a product and ensure consistent sorting of attributes", () => {
    const product = new Product("PROD-1", "Classic Tee");

    const variantRedSmall = product.addVariant(
      SKU.create("TSHIRT-SM-RED"),
      [
        new VariantAttribute("color", "red"),
        new VariantAttribute("size", "S"),
      ]
    );

    expect(variantRedSmall.sku.getValue()).toBe("TSHIRT-SM-RED");
    expect(product.variants.length).toBe(1);

    const attrs = variantRedSmall.attributes.all();
    expect(attrs[0].name).toBe("color");
    expect(attrs[1].name).toBe("size");
  });

  it("should prevent duplicate variant attribute combinations on the same product", () => {
    const product = new Product("PROD-1", "Classic Tee");

    product.addVariant(
      SKU.create("TSHIRT-SM-RED"),
      [
        new VariantAttribute("color", "red"),
        new VariantAttribute("size", "S"),
      ]
    );

    expect(() => {
      product.addVariant(
        SKU.create("TSHIRT-SM-RED-2"),
        [
          new VariantAttribute("size", "S"),
          new VariantAttribute("color", "red"),
        ]
      );
    }).toThrow(DuplicateVariantException);
  });

  it("should add a variant with optional weight and volume parameters", () => {
    const product = new Product("PROD-2", "Heavy Mug");
    const variant = product.addVariant(
      SKU.create("MUG-HEAVY"),
      [new VariantAttribute("material", "ceramic")],
      500,
      0.002
    );

    expect(variant.weightGrams).toBe(500);
    expect(variant.volumeCubicMeters).toBe(0.002);
  });

  it("should find an existing variant by its id", () => {
    const product = new Product("PROD-3", "Hat");
    const variant = product.addVariant(
      SKU.create("HAT-BLU"),
      [new VariantAttribute("color", "blue")]
    );

    const found = product.findVariant(variant.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(variant.id);
  });

  it("should return null when finding a non-existent variant id", () => {
    const product = new Product("PROD-4", "Scarf");
    const found = product.findVariant("invalid-id");
    expect(found).toBeNull();
  });
});