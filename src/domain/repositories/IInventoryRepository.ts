import { SKU } from "../valueObjects/SKU";
import { InventoryItem } from "../aggregates/InventoryItem";

export interface IInventoryRepository {
  findBySku(sku: SKU): Promise<InventoryItem | null>;
  findAll(): Promise<InventoryItem[]>;
  save(item: InventoryItem): Promise<void>;
  // New method for opening balance conflict check
  hasAnyEntries(variantId: string, locationId: string): Promise<boolean>;
  findBySkus?(skus: SKU[]): Promise<InventoryItem[]>;
  saveMany?(items: InventoryItem[]): Promise<void>;
}
