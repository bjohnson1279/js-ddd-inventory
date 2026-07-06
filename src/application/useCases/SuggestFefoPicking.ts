import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { IProductRepository } from "../../domain/repositories/IProductRepository";
import { SKU } from "../../domain/valueObjects/SKU";

export interface FefoPickSuggestion {
  locationId: string;
  lotNumber: string;
  expirationDate: Date;
  quantity: number;
}

export class SuggestFefoPicking {
  constructor(
    private readonly productRepository: IProductRepository,
    private readonly costLayerRepository: ICostLayerRepository
  ) {}

  async execute(skuStr: string, quantity: number): Promise<FefoPickSuggestion[]> {
    if (quantity <= 0) {
      throw new Error("Pick quantity must be positive.");
    }

    const sku = SKU.create(skuStr);
    const product = await this.productRepository.findBySku(sku);
    if (!product) {
      throw new Error(`Product variant with SKU ${skuStr} not found.`);
    }

    const variant = product.findVariantBySku(skuStr);
    if (!variant) {
      throw new Error(`Product variant with SKU ${skuStr} not found.`);
    }

    // Get active layers sorted by expiration date (FEFO)
    const activeLayers = await this.costLayerRepository.getActiveLayers(variant.id, "expiration_date ASC");
    const lotLayers = activeLayers.filter((l) => l.lotNumber !== null && l.lotNumber !== undefined);

    if (lotLayers.length === 0) {
      throw new Error(`No lot-controlled inventory layers found for SKU ${skuStr}.`);
    }

    const suggestions: FefoPickSuggestion[] = [];
    let remainingToPick = quantity;

    for (const layer of lotLayers) {
      if (remainingToPick <= 0) break;

      const available = layer.remainingQuantity;
      if (available <= 0) continue;

      const allocated = Math.min(remainingToPick, available);
      remainingToPick -= allocated;

      suggestions.push({
        locationId: layer.locationId || "default",
        lotNumber: layer.lotNumber!,
        expirationDate: layer.expirationDate!,
        quantity: allocated
      });
    }

    if (remainingToPick > 0) {
      throw new Error(
        `Insufficient lot-controlled inventory available to pick ${quantity} units for SKU ${skuStr} (Missing: ${remainingToPick}).`
      );
    }

    return suggestions;
  }
}
