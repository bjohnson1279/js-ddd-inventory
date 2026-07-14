import { InventoryCostLayer } from "../accounting/entities/InventoryCostLayer";

export interface ICostLayerRepository {
  getActiveLayers(variantId: string, orderBy?: string): Promise<InventoryCostLayer[]>;
  getActiveLayersBatch(variantIds: string[], orderBy?: string): Promise<Map<string, InventoryCostLayer[]>>;
  save(layer: InventoryCostLayer): Promise<void>;
  saveMany(layers: InventoryCostLayer[]): Promise<void>;
}
