import { ICostLayerRepository } from "../../repositories/ICostLayerRepository";
import { CostBreakdown } from "../valueObjects/CostBreakdown";
import { InventoryCostLayer } from "../entities/InventoryCostLayer";
import { CostingMethod } from "../enums/CostingMethod";
import { CostingStrategyRegistry } from "../strategies/CostingStrategyRegistry";

export class CostLayerService {
  constructor(private readonly layers: ICostLayerRepository) {}

  public async calculateCost(
    variantId: string,
    quantity: number,
    method: CostingMethod = CostingMethod.FIFO
  ): Promise<CostBreakdown> {
    const activeLayers = await this.layers.getActiveLayers(variantId);
    const strategy = CostingStrategyRegistry.get(method);
    return strategy.calculateCost(activeLayers, quantity, variantId);
  }

  public async consumeLayers(
    variantId: string,
    quantity: number,
    method: CostingMethod = CostingMethod.FIFO
  ): Promise<CostBreakdown> {
    const activeLayers = await this.layers.getActiveLayers(variantId);
    const strategy = CostingStrategyRegistry.get(method);
    const breakdown = strategy.consumeLayers(activeLayers, quantity, variantId);

    if (this.layers.saveMany) {
      await this.layers.saveMany(activeLayers);
    } else {
      await Promise.all(
        activeLayers.map((layer) => this.layers.save(layer))
      );
    }

    return breakdown;
  }

  // Backwards compatibility helpers
  public async calculateFifoCost(
    variantId: string,
    quantity: number
  ): Promise<CostBreakdown> {
    return this.calculateCost(variantId, quantity, CostingMethod.FIFO);
  }

  public async consumeFifoLayers(
    variantId: string,
    quantity: number
  ): Promise<CostBreakdown> {
    return this.consumeLayers(variantId, quantity, CostingMethod.FIFO);
  }

  public async calculateWeightedAverageCost(
    variantId: string,
    quantity: number
  ): Promise<CostBreakdown> {
    return this.calculateCost(variantId, quantity, CostingMethod.WeightedAverageCost);
  }

  // Batch operations
  public async consumeLayersBatch(
    components: { variantId: string; quantity: number }[],
    method: CostingMethod = CostingMethod.FIFO
  ): Promise<CostBreakdown[]> {
    // 1. Accumulate all variant IDs to prefetch their active layers
    const variantIds = Array.from(new Set(components.map((c) => c.variantId)));

    // 2. Prefetch all active layers in batch to reduce queries
    const activeLayersByVariant = new Map<string, InventoryCostLayer[]>();
    await Promise.all(
      variantIds.map(async (vId) => {
        const layers = await this.layers.getActiveLayers(vId);
        activeLayersByVariant.set(vId, layers);
      })
    );

    // 3. Sequentially consume layers in-memory
    const breakdowns: CostBreakdown[] = [];
    const modifiedLayers = new Set<InventoryCostLayer>();
    const strategy = CostingStrategyRegistry.get(method);

    for (const comp of components) {
      const activeLayers = activeLayersByVariant.get(comp.variantId) || [];
      const breakdown = strategy.consumeLayers(activeLayers, comp.quantity, comp.variantId);
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

  public async consumeFifoLayersBatch(
    components: { variantId: string; quantity: number }[]
  ): Promise<CostBreakdown[]> {
    return this.consumeLayersBatch(components, CostingMethod.FIFO);
  }
}
