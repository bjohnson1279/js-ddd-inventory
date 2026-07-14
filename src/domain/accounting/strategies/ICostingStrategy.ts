import { InventoryCostLayer } from "../entities/InventoryCostLayer";
import { CostBreakdown } from "../valueObjects/CostBreakdown";

export interface ICostingStrategy {
  calculateCost(
    layers: InventoryCostLayer[],
    quantity: number,
    variantId: string
  ): CostBreakdown;

  consumeLayers(
    layers: InventoryCostLayer[],
    quantity: number,
    variantId: string
  ): CostBreakdown;
}
