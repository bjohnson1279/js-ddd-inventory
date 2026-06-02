import { IInventoryRepository } from "../repositories/IInventoryRepository";
import { Kit } from "../kit/aggregates/Kit";
import { SKU } from "../valueObjects/SKU";
import { Quantity } from "../valueObjects/Quantity";
import { InsufficientInventoryException } from "../exceptions/InsufficientInventoryException";

export class InventoryService {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  public async decrementForSale(
    variantId: string,
    quantity: number,
    saleId: string,
    actorId: string
  ): Promise<void> {
    const sku = SKU.create(variantId);
    await this.assertSufficientStock(variantId, quantity);

    const item = await this.inventoryRepository.findBySku(sku);
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

    // --- Pass 1: Fetch and validate all components concurrently ---
    const itemsWithNeeds = await Promise.all(
      kit.components.map(async (component) => {
        const needed = component.quantity * kitQuantity;
        const sku = SKU.create(component.variantId);
        const item = await this.inventoryRepository.findBySku(sku);
        const available = item ? item.quantity.getValue() : 0;

        if (available < needed) {
          throw new InsufficientInventoryException(component.variantId, available, needed);
        }

        if (!item) {
          throw new Error(`Item with SKU ${component.variantId} not found in inventory.`);
        }

        return { item, needed };
      })
    );

    // --- Pass 2: Deduct stock and save ---
    // Note: If saving needs to be transactional, that should be handled by a UoW or repository method.
    // Assuming sequential saves as per previous implementation logic for now, but skipping re-fetches.
    for (const { item, needed } of itemsWithNeeds) {
      item.dispatchStock(Quantity.create(needed));
      await this.inventoryRepository.save(item);
    }
  }

  private async assertSufficientStock(variantId: string, needed: number): Promise<void> {
    const sku = SKU.create(variantId);
    const item = await this.inventoryRepository.findBySku(sku);
    const available = item ? item.quantity.getValue() : 0;

    if (available < needed) {
      throw new InsufficientInventoryException(variantId, available, needed);
    }
  }
}
