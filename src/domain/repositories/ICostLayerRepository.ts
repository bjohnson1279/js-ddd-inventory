import { InventoryCostLayer } from "../accounting/entities/InventoryCostLayer";

export interface ICostLayerRepository {
  getActiveLayers(variantId: string, orderBy?: "asc" | "desc"): Promise<InventoryCostLayer[]>;
  save(layer: InventoryCostLayer): Promise<void>;
  saveMany?(layers: InventoryCostLayer[]): Promise<void>;
}
