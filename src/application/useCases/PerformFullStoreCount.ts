import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";

export interface CountItemDTO {
  sku: string;
  count: number;
}

export class PerformFullStoreCount {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(countedItems: CountItemDTO[]): Promise<void> {
    const allExistingItems = await this.inventoryRepository.findAll();
    
    // Map to quickly find counted items
    const countMap = new Map<string, number>();
    for (const item of countedItems) {
      countMap.set(item.sku, item.count);
    }

    const itemsToSave: InventoryItem[] = [];

    // Process all existing items
    for (const item of allExistingItems) {
      const skuStr = item.sku.getValue();
      const countedQty = countMap.get(skuStr);
      
      if (countedQty !== undefined) {
        // Item was counted, update to new quantity
        item.reconcileCount(Quantity.create(countedQty));
        countMap.delete(skuStr); // Remove so we know what's left are new items
      } else {
        // Item was NOT counted, meaning it's missing in store -> quantity 0
        item.reconcileCount(Quantity.create(0));
      }
      
      itemsToSave.push(item);
    }

    // Any items remaining in countMap are NEW items we didn't have in the repository before
    for (const [skuStr, count] of countMap.entries()) {
      const sku = SKU.create(skuStr);
      const quantity = Quantity.create(count);
      const newItem = InventoryItem.create(Date.now().toString() + Math.random().toString(), sku, quantity);
      itemsToSave.push(newItem);
    }

    // ⚡ Bolt Performance: Use batch saveMany to prevent N+1 query connection pool exhaustion
    // when saving the full store count. Falls back to Promise.all if saveMany is not implemented.
    if (this.inventoryRepository.saveMany) {
      await this.inventoryRepository.saveMany(itemsToSave);
    } else {
      await Promise.all(itemsToSave.map(item => this.inventoryRepository.save(item)));
    }
  }
}
