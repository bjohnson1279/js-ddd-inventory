import { SKU } from "../valueObjects/SKU";
import { InventoryItem } from "../aggregates/InventoryItem";

export interface IInventoryRepository {
  findBySku(sku: SKU, locationId?: string): Promise<InventoryItem | null>;
  findBySkus?(skus: SKU[], locationId?: string): Promise<InventoryItem[]>;
  findAll(): Promise<InventoryItem[]>;
  findAllByLocation(locationId: string): Promise<InventoryItem[]>;
  save(item: InventoryItem): Promise<void>;
  saveMany?(items: InventoryItem[]): Promise<void>;
  // New method for opening balance conflict check
  hasAnyEntries(variantId: string, locationId: string): Promise<boolean>;
  hasConflicts?(variantIds: string[], locationId: string): Promise<string[]>;
}
