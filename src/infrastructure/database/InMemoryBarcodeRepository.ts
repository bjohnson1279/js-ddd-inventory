import { IBarcodeRepository } from "../../domain/repositories/IBarcodeRepository";
import { VariantBarcodeSet } from "../../domain/barcode/aggregates/VariantBarcodeSet";

export class InMemoryBarcodeRepository implements IBarcodeRepository {
  private readonly sets: Map<string, VariantBarcodeSet> = new Map();

  public async findVariantByBarcodeValue(value: string): Promise<string | null> {
    const normalized = value.trim().toUpperCase();
    for (const set of this.sets.values()) {
      for (const assignment of set.all()) {
        if (assignment.barcode.value === normalized) {
          return set.variantId;
        }
      }
    }
    return null;
  }

  public async findSetForVariant(variantId: string): Promise<VariantBarcodeSet> {
    let set = this.sets.get(variantId);
    if (!set) {
      set = new VariantBarcodeSet(variantId);
      this.sets.set(variantId, set);
    }
    return set;
  }

  public async saveSet(set: VariantBarcodeSet): Promise<void> {
    this.sets.set(set.variantId, set);
  }
}
