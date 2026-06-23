import { IInventoryRepository } from "../repositories/IInventoryRepository";
import { Kit } from "../kit/aggregates/Kit";
import { SKU } from "../valueObjects/SKU";
import { Quantity } from "../valueObjects/Quantity";
import { InsufficientInventoryException } from "../exceptions/InsufficientInventoryException";
import { InventoryItem } from "../aggregates/InventoryItem";
import { ReorderPolicyService } from "../procurement/services/ReorderPolicyService";

export class InventoryService {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly reorderPolicyService?: ReorderPolicyService
  ) {}

  public async decrementForSale(
    variantId: string,
    quantity: number,
    saleId: string,
    actorId: string,
    locationId: string = "default"
  ): Promise<void> {
    const sku = SKU.create(variantId);
    const item = await this.inventoryRepository.findBySku(sku, locationId);

    const available = item ? item.quantity.getValue() : 0;
    if (available < quantity) {
      throw new InsufficientInventoryException(variantId, available, quantity);
    }

    if (!item) {
      throw new Error(`Item with SKU ${variantId} not found in inventory.`);
    }

    item.dispatchStock(Quantity.create(quantity));
    await this.inventoryRepository.save(item);

    if (this.reorderPolicyService) {
      await this.reorderPolicyService.checkPolicy(variantId, locationId, item.quantity.getValue());
    }
  }

  public async decrementForKitSale(
    kit: Kit,
    kitQuantity: number,
    saleId: string,
    actorId: string,
    locationId: string = "default"
  ): Promise<void> {
    if (kit.isEmpty()) {
      throw new Error("Cannot sell a kit with no components.");
    }

    // --- Pass 1: validate all components upfront and cache items ---
    const cachedItems = new Map<string, InventoryItem>();

    // Optimize: Batch fetch all components at once if repository supports it
    if (this.inventoryRepository.findBySkus) {
      const skus = kit.components.map(c => SKU.create(c.variantId));
      const items = await this.inventoryRepository.findBySkus(skus, locationId);
      for (const item of items) {
        cachedItems.set(item.sku.getValue(), item);
      }
    }

    if (!this.inventoryRepository.findBySkus) {
      // Fallback: fetch individually concurrently if batch fetch isn't supported
      const fetchPromises = kit.components
        .filter((c) => !cachedItems.has(c.variantId))
        .map(async (c) => {
          const sku = SKU.create(c.variantId);
          const fetchedItem = await this.inventoryRepository.findBySku(sku, locationId);
          if (fetchedItem) {
            cachedItems.set(c.variantId, fetchedItem);
          }
        });
      await Promise.all(fetchPromises);
    }

    for (const component of kit.components) {
      const needed = component.quantity * kitQuantity;
      const item = cachedItems.get(component.variantId);

      const available = item ? item.quantity.getValue() : 0;
      if (available < needed) {
        throw new InsufficientInventoryException(component.variantId, available, needed);
      }
    }

    // --- Pass 2: write ledger entries for each component ---
    const itemsToSave: InventoryItem[] = [];
    for (const component of kit.components) {
      const needed = component.quantity * kitQuantity;
      const item = cachedItems.get(component.variantId);

      if (!item) {
        throw new Error(`Item with SKU ${component.variantId} not found in inventory.`);
      }

      item.dispatchStock(Quantity.create(needed));
      itemsToSave.push(item);
    }

    if (this.inventoryRepository.saveMany) {
      await this.inventoryRepository.saveMany(itemsToSave);
    } else {
      await Promise.all(
        itemsToSave.map((item) => this.inventoryRepository.save(item))
      );
    }

    if (this.reorderPolicyService) {
      await Promise.all(
        itemsToSave.map((item) =>
          this.reorderPolicyService!.checkPolicy(
            item.sku.getValue(),
            locationId,
            item.quantity.getValue()
          )
        )
      );
    }
  }
}
