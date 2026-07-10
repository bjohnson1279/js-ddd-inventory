import { SKU } from "../../valueObjects/SKU";
import { VariantAttribute } from "../valueObjects/VariantAttribute";
import { VariantAttributeSet } from "../valueObjects/VariantAttributeSet";
import { ProductVariant } from "../entities/ProductVariant";
import { DuplicateVariantException } from "../exceptions/DuplicateVariantException";

export class Product {
  private readonly _variants: Map<string, ProductVariant> = new Map();

  constructor(
    public readonly id: string,
    public readonly name: string
  ) {}

  public addVariant(
    sku: SKU,
    attributes: VariantAttribute[],
    weightGrams: number | null = null,
    volumeCubicMeters: number | null = null
  ): ProductVariant {
    const attributeSet = new VariantAttributeSet(attributes);

    for (const existing of this._variants.values()) {
      if (existing.attributes.equals(attributeSet)) {
        throw new DuplicateVariantException(
          `A variant with these attributes already exists on product ${this.id}.`
        );
      }
    }

    const variant = new ProductVariant(
      crypto.randomUUID(),
      this.id,
      sku,
      attributeSet,
      weightGrams,
      volumeCubicMeters
    );

    this._variants.set(variant.id, variant);
    return variant;
  }

  public findVariant(id: string): ProductVariant | null {
    return this._variants.get(id) || null;
  }

  public findVariantBySku(skuStr: string): ProductVariant | null {
    for (const variant of this._variants.values()) {
      if (variant.sku.getValue() === skuStr) {
        return variant;
      }
    }
    return null;
  }

  public get variants(): ProductVariant[] {
    return Array.from(this._variants.values());
  }
}
