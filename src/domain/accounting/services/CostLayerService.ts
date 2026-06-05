import { ICostLayerRepository } from "../../repositories/ICostLayerRepository";
import { CostBreakdown } from "../valueObjects/CostBreakdown";
import { InventoryCostLayer } from "../entities/InventoryCostLayer";
import { InsufficientInventoryException } from "../../exceptions/InsufficientInventoryException";

export class CostLayerService {
  constructor(private readonly layers: ICostLayerRepository) {}

  public async calculateFifoCost(
    variantId: string,
    quantity: number
  ): Promise<CostBreakdown> {
    const activeLayers = await this.layers.getActiveLayers(variantId, "asc");
    return this.consumeLayers(activeLayers, quantity, false);
  }

  public async consumeFifoLayers(
    variantId: string,
    quantity: number
  ): Promise<CostBreakdown> {
    const activeLayers = await this.layers.getActiveLayers(variantId, "asc");
    const breakdown = this.consumeLayers(activeLayers, quantity, true);

    for (const layer of activeLayers) {
      await this.layers.save(layer);
    }

    return breakdown;
  }

  public async calculateWeightedAverageCost(
    variantId: string,
    quantity: number
  ): Promise<CostBreakdown> {
    const activeLayers = await this.layers.getActiveLayers(variantId);

    let totalUnits = 0;
    let totalValue = 0;

    for (const layer of activeLayers) {
      totalUnits += layer.remainingQuantity;
      totalValue += layer.remainingCostCents();
    }

    if (totalUnits === 0 || totalUnits < quantity) {
      throw new InsufficientInventoryException(variantId, totalUnits, quantity);
    }

    const avgCostCents = totalValue / totalUnits;
    return new CostBreakdown(quantity, Math.round(quantity * avgCostCents));
  }

  private consumeLayers(
    layers: InventoryCostLayer[],
    quantity: number,
    applyConsumption: boolean
  ): CostBreakdown {
    let remaining = quantity;
    let totalCost = 0;

    for (const layer of layers) {
      if (remaining <= 0) {
        break;
      }

      if (applyConsumption) {
        const consumed = layer.consume(remaining);
        totalCost += consumed * layer.unitCostCents;
        remaining -= consumed;
      } else {
        const consumed = Math.min(remaining, layer.remainingQuantity);
        totalCost += consumed * layer.unitCostCents;
        remaining -= consumed;
      }
    }

    if (remaining > 0) {
      const totalAvailable = layers.reduce((acc, l) => acc + l.remainingQuantity, 0);
      throw new InsufficientInventoryException(
        layers.length > 0 ? layers[0].variantId : "UNKNOWN",
        totalAvailable,
        quantity
      );
    }

    return new CostBreakdown(quantity, totalCost);
  }
}
