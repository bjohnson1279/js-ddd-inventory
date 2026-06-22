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

    if (this.layers.saveMany) {
      await this.layers.saveMany(activeLayers);
    } else {
      await Promise.all(
        activeLayers.map((layer) => this.layers.save(layer))
      );
    }

    return breakdown;
  }

    public async consumeFifoLayersBatch(
    components: { variantId: string; quantity: number }[]
  ): Promise<CostBreakdown[]> {
    // 1. Accumulate all variant IDs to prefetch their active layers
    const variantIds = Array.from(new Set(components.map((c) => c.variantId)));

    // 2. Prefetch all active layers in batch to reduce queries
    const activeLayersByVariant = new Map<string, InventoryCostLayer[]>();
    await Promise.all(
      variantIds.map(async (vId) => {
        const layers = await this.layers.getActiveLayers(vId, "asc");
        activeLayersByVariant.set(vId, layers);
      })
    );

    // 3. Sequentially consume layers in-memory to prevent race conditions
    const breakdowns: CostBreakdown[] = [];
    const modifiedLayers = new Set<InventoryCostLayer>();

    for (const comp of components) {
      const activeLayers = activeLayersByVariant.get(comp.variantId) || [];
      const breakdown = this.consumeLayers(activeLayers, comp.quantity, true);
      breakdowns.push(breakdown);
      for (const layer of activeLayers) {
        if (layer.remainingQuantity < layer.originalQuantity) {
            modifiedLayers.add(layer);
        }
      }
    }

    // 4. Batch save all modified layers at once
    const layersToSave = Array.from(modifiedLayers);
    if (layersToSave.length > 0) {
      if (this.layers.saveMany) {
        await this.layers.saveMany(layersToSave);
      } else {
        await Promise.all(layersToSave.map((layer) => this.layers.save(layer)));
      }
    }

    return breakdowns;
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
