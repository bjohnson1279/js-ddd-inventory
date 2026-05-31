import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { InventoryCostLayer } from "../../domain/accounting/entities/InventoryCostLayer";

export class InMemoryCostLayerRepository implements ICostLayerRepository {
  private readonly layers: Map<string, InventoryCostLayer> = new Map();

  public async getActiveLayers(
    variantId: string,
    orderBy?: "asc" | "desc"
  ): Promise<InventoryCostLayer[]> {
    const list: InventoryCostLayer[] = [];

    for (const layer of this.layers.values()) {
      if (layer.variantId === variantId && layer.remainingQuantity > 0) {
        list.push(layer);
      }
    }

    if (orderBy === "asc") {
      list.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
    } else if (orderBy === "desc") {
      list.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
    }

    return list;
  }

  public async save(layer: InventoryCostLayer): Promise<void> {
    this.layers.set(layer.id, layer);
  }
}
