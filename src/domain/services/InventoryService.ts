import { IInventoryRepository } from "../repositories/IInventoryRepository";
import { Kit } from "../kit/aggregates/Kit";
import { SKU } from "../valueObjects/SKU";
import { Quantity } from "../valueObjects/Quantity";
import { InsufficientInventoryException } from "../exceptions/InsufficientInventoryException";

import { InventoryItem } from "../aggregates/InventoryItem";

export class InventoryService {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  public async decrementForSale(
    variantId: string,
    quantity: number,
    saleId: string,
    actorId: string
  ): Promise<void> {
    const sku = SKU.create(variantId);
    const item = await this.inventoryRepository.findBySku(sku);

    const available = item ? item.quantity.getValue() : 0;
    if (available < quantity) {
      throw new InsufficientInventoryException(variantId, available, quantity);
    }

    if (!item) {
      throw new Error(`Item with SKU ${variantId} not found in inventory.`);
    }

    item.dispatchStock(Quantity.create(quantity));
    await this.inventoryRepository.save(item);
  }

  public async decrementForKitSale(
    kit: Kit,
    kitQuantity: number,
    saleId: string,
    actorId: string
  ): Promise<void> {
    if (kit.isEmpty()) {
      throw new Error("Cannot sell a kit with no components.");
    }

    // --- Pass 1: validate all components upfront and cache items ---
    const cachedItems = new Map<string, InventoryItem>();

    for (const component of kit.components) {
      const needed = component.quantity * kitQuantity;
      const sku = SKU.create(component.variantId);
      const item = await this.inventoryRepository.findBySku(sku);

      const available = item ? item.quantity.getValue() : 0;
      if (available < needed) {
        throw new InsufficientInventoryException(component.variantId, available, needed);
      }

      if (item) {
        cachedItems.set(component.variantId, item);
      }
    }

    // --- Pass 2: write ledger entries for each component ---
    for (const component of kit.components) {
      const needed = component.quantity * kitQuantity;
      const item = cachedItems.get(component.variantId);

      if (!item) {
        throw new Error(`Item with SKU ${component.variantId} not found in inventory.`);
      }

        return { item, needed };
      })
    );

    // --- Pass 2: Deduct stock and save concurrently ---
    // Note: If saving needs to be transactional, that should be handled by a UoW or repository method.
    await Promise.all(
      itemsWithNeeds.map(async ({ item, needed }) => {
        item.dispatchStock(Quantity.create(needed));
        await this.inventoryRepository.save(item);
      })
    );
  }
}
