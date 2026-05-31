import { Product } from "../../../src/domain/product/aggregates/Product";
import { VariantAttribute } from "../../../src/domain/product/valueObjects/VariantAttribute";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { DuplicateVariantException } from "../../../src/domain/product/exceptions/DuplicateVariantException";

describe("Product and Variant Domain", () => {
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
});
