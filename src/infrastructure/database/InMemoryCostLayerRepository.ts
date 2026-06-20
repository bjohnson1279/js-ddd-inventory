import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { InventoryCostLayer } from "../../domain/accounting/entities/InventoryCostLayer";

export class InMemoryCostLayerRepository implements ICostLayerRepository {
  private readonly layers: Map<string, InventoryCostLayer> = new Map();

  public async getActiveLayers(
    variantId: string,
    orderBy?: string
  ): Promise<InventoryCostLayer[]> {
    const list: InventoryCostLayer[] = [];

    for (const layer of this.layers.values()) {
      if (layer.variantId === variantId && layer.remainingQuantity > 0) {
        list.push(layer);
      }
    }

    const isExpiration = orderBy?.toLowerCase().includes("expiration");
    const orderDirection = orderBy?.toLowerCase().includes("desc") ? "desc" : "asc";

    if (isExpiration) {
      list.sort((a, b) => {
        const aExp = a.expirationDate ? a.expirationDate.getTime() : Infinity;
        const bExp = b.expirationDate ? b.expirationDate.getTime() : Infinity;
        if (aExp !== bExp) {
          return orderDirection === "desc" ? bExp - aExp : aExp - bExp;
        }
        return a.receivedAt.getTime() - b.receivedAt.getTime();
      });
    } else if (orderBy) {
      if (orderDirection === "asc") {
        list.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
      } else {
        list.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
      }
    }

    return list;
  }

  public async save(layer: InventoryCostLayer): Promise<void> {
    this.layers.set(layer.id, layer);
  }

  public async saveMany(layers: InventoryCostLayer[]): Promise<void> {
    for (const layer of layers) {
      await this.save(layer);
    }
  }
}
