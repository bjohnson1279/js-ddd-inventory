import { StockOnboarding } from "../aggregates/StockOnboarding";
import { IInventoryRepository } from "../../repositories/IInventoryRepository";
import { SKU } from "../../valueObjects/SKU";
import { InventoryItem } from "../../aggregates/InventoryItem";
import { Quantity } from "../../valueObjects/Quantity";

export class OpeningBalanceService {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  public async process(
    onboarding: StockOnboarding,
    actorId: string
  ): Promise<void> {
    if (!onboarding.isSubmitted()) {
      throw new Error(
        "Only submitted onboardings can be processed. Call submit() first."
      );
    }

    const items = onboarding.getItems();

    // --- Pass 1: Guard against duplicate opening balances ---
    if (this.inventoryRepository.hasConflicts) {
      const variantIds = items.map((item) => item.variantId);
      const conflicts = await this.inventoryRepository.hasConflicts(
        variantIds,
        onboarding.locationId
      );
      if (conflicts.length > 0) {
        throw new Error(
          `Opening balance conflict for variant(s) ${conflicts.join(", ")} at location ${onboarding.locationId}`
        );
      }
    } else {
      for (const item of items) {
        if (
          await this.inventoryRepository.hasAnyEntries(
            item.variantId,
            onboarding.locationId
          )
        ) {
          throw new Error(
            `Opening balance conflict for variant ${item.variantId} at location ${onboarding.locationId}`
          );
        }
      }
    }

    // --- Pass 2: Post ledger entries ---
    // Pre-fetch items to avoid N+1 reads
    const skus = items.map((item) => SKU.create(item.variantId));
    let existingItems: InventoryItem[] = [];

    if (this.inventoryRepository.findBySkus) {
      existingItems = await this.inventoryRepository.findBySkus(skus);
    } else {
      for (const sku of skus) {
        const item = await this.inventoryRepository.findBySku(sku);
        if (item) existingItems.push(item);
      }
    }

    const itemsBySku = new Map(existingItems.map((item) => [item.sku.getValue(), item]));
    const itemsToSave: InventoryItem[] = [];

    // In this simplified implementation, we update/create InventoryItems.
    // In a full implementation, we would append to a ledger.
    for (const item of items) {
      // Assuming variantId is used as SKU for simplicity in this draft
      const sku = SKU.create(item.variantId);
      let inventoryItem = itemsBySku.get(sku.getValue());

      if (!inventoryItem) {
        inventoryItem = InventoryItem.create(
          Date.now().toString() + Math.random(),
          sku,
          Quantity.create(0)
        );
      }

      inventoryItem.reconcileCount(Quantity.create(item.quantity));
      itemsToSave.push(inventoryItem);

      // In a real system, we'd also record the unit cost and emit events
    }

    if (this.inventoryRepository.saveMany) {
      await this.inventoryRepository.saveMany(itemsToSave);
    } else {
      for (const item of itemsToSave) {
        await this.inventoryRepository.save(item);
      }
    }
  }
}
