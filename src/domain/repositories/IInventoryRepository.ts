import { SKU } from "../valueObjects/SKU";
import { InventoryItem } from "../aggregates/InventoryItem";

export interface IInventoryRepository {
  findBySku(sku: SKU): Promise<InventoryItem | null>;
  findBySkus?(skus: SKU[]): Promise<InventoryItem[]>;
  findAll(): Promise<InventoryItem[]>;
  save(item: InventoryItem): Promise<void>;
  saveMany?(items: InventoryItem[]): Promise<void>;
  // New method for opening balance conflict check
  hasAnyEntries(variantId: string, locationId: string): Promise<boolean>;
}
