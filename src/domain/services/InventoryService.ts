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

    // --- Pass 1: validate all components upfront ---
    for (const component of kit.components) {
      const needed = component.quantity * kitQuantity;
      await this.assertSufficientStock(component.variantId, needed);
    }

    // --- Pass 2: write ledger entries for each component ---
    for (const component of kit.components) {
      const sku = SKU.create(component.variantId);
      const needed = component.quantity * kitQuantity;

      const item = await this.inventoryRepository.findBySku(sku);
      if (!item) {
        throw new Error(`Item with SKU ${component.variantId} not found in inventory.`);
      }

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
