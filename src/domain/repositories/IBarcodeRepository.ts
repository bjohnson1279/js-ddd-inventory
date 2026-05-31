import { VariantBarcodeSet } from "../barcode/aggregates/VariantBarcodeSet";

export interface IBarcodeRepository {
  findVariantByBarcodeValue(value: string): Promise<string | null>;
  findSetForVariant(variantId: string): Promise<VariantBarcodeSet>;
  saveSet(set: VariantBarcodeSet): Promise<void>;
}
