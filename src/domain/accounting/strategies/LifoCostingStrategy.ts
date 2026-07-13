import { ICostingStrategy } from "./ICostingStrategy";
import { InventoryCostLayer } from "../entities/InventoryCostLayer";
import { CostBreakdown } from "../valueObjects/CostBreakdown";
import { InsufficientInventoryException } from "../../exceptions/InsufficientInventoryException";

export class LifoCostingStrategy implements ICostingStrategy {
  public calculateCost(
    layers: InventoryCostLayer[],
    quantity: number,
    variantId: string
  ): CostBreakdown {
    const sorted = [...layers].sort(
      (a, b) => b.receivedAt.getTime() - a.receivedAt.getTime()
    );
    let remaining = quantity;
    let totalCost = 0;

    for (const layer of sorted) {
      if (remaining <= 0) break;
      const consumed = Math.min(remaining, layer.remainingQuantity);
      totalCost += consumed * layer.unitCostCents;
      remaining -= consumed;
    }

    if (remaining > 0) {
      const totalAvailable = layers.reduce((acc, l) => acc + l.remainingQuantity, 0);
      throw new InsufficientInventoryException(variantId, totalAvailable, quantity);
    }

    return new CostBreakdown(quantity, totalCost);
  }

  public consumeLayers(
    layers: InventoryCostLayer[],
    quantity: number,
    variantId: string
  ): CostBreakdown {
    const sorted = [...layers].sort(
      (a, b) => b.receivedAt.getTime() - a.receivedAt.getTime()
    );
    let remaining = quantity;
    let totalCost = 0;

    for (const layer of sorted) {
      if (remaining <= 0) break;
      const consumed = layer.consume(remaining);
      totalCost += consumed * layer.unitCostCents;
      remaining -= consumed;
    }

    if (remaining > 0) {
      const totalAvailable = layers.reduce((acc, l) => acc + l.remainingQuantity, 0);
      throw new InsufficientInventoryException(variantId, totalAvailable, quantity);
    }

    return new CostBreakdown(quantity, totalCost);
  }
}
