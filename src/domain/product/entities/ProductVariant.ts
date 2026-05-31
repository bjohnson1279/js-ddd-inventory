import { SKU } from "../../valueObjects/SKU";
import { VariantAttributeSet } from "../valueObjects/VariantAttributeSet";

export class ProductVariant {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly sku: SKU,
    public readonly attributes: VariantAttributeSet
  ) {}
}
