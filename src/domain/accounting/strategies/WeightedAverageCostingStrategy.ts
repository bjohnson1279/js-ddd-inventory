import { ICostingStrategy } from "./ICostingStrategy";
import { InventoryCostLayer } from "../entities/InventoryCostLayer";
import { CostBreakdown } from "../valueObjects/CostBreakdown";
import { InsufficientInventoryException } from "../../exceptions/InsufficientInventoryException";

export class WeightedAverageCostingStrategy implements ICostingStrategy {
  public calculateCost(
    layers: InventoryCostLayer[],
    quantity: number,
    variantId: string
  ): CostBreakdown {
    let totalUnits = 0;
    let totalValue = 0;

    for (const layer of layers) {
      totalUnits += layer.remainingQuantity;
      totalValue += layer.remainingCostCents();
    }

    if (totalUnits === 0 || totalUnits < quantity) {
      throw new InsufficientInventoryException(variantId, totalUnits, quantity);
    }

    const avgCostCents = totalValue / totalUnits;
    return new CostBreakdown(quantity, Math.round(quantity * avgCostCents));
  }

  public consumeLayers(
    layers: InventoryCostLayer[],
    quantity: number,
    variantId: string
  ): CostBreakdown {
    const breakdown = this.calculateCost(layers, quantity, variantId);

    // Consume layers in FIFO order
    const sorted = [...layers].sort(
      (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()
    );
    let remaining = quantity;

    for (const layer of sorted) {
      if (remaining <= 0) break;
      const consumed = layer.consume(remaining);
      remaining -= consumed;
    }

    return breakdown;
  }
}
