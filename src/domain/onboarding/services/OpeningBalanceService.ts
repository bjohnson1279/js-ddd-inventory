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
    await Promise.all(
      items.map(async (item) => {
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
      })
    );

    // --- Pass 2: Post ledger entries ---
    // Pre-fetch all relevant inventory items at once to avoid N+1 query issue
    const skus = items.map(item => SKU.create(item.variantId));
    let existingItems: InventoryItem[] = [];
    if (this.inventoryRepository.findBySkus) {
      existingItems = await this.inventoryRepository.findBySkus(skus);
    } else {
      // Fallback for repositories that don't support findBySkus
      existingItems = (await Promise.all(
        skus.map(sku => this.inventoryRepository.findBySku(sku))
      )).filter((item): item is InventoryItem => item !== null);
    }

    const itemMap = new Map<string, InventoryItem>();
    existingItems.forEach(item => {
      itemMap.set(item.sku.getValue(), item);
    });

    // In this simplified implementation, we update/create InventoryItems.
    // In a full implementation, we would append to a ledger.
    for (const item of items) {
      const skuValue = item.variantId;
      const sku = SKU.create(skuValue);
      let inventoryItem = itemMap.get(skuValue);

      if (!inventoryItem) {
        inventoryItem = InventoryItem.create(
          Date.now().toString() + Math.random(),
          sku,
          Quantity.create(0)
        );
      }

      inventoryItem.reconcileCount(Quantity.create(item.quantity));

      // Keep track of new items in case there are multiple entries for the same SKU
      // in the same onboarding payload
      itemMap.set(skuValue, inventoryItem);

      // In a real system, we'd also record the unit cost and emit events
    }

    const uniqueItemsToSave = Array.from(itemMap.values());

    if (this.inventoryRepository.saveMany && uniqueItemsToSave.length > 0) {
       await this.inventoryRepository.saveMany(uniqueItemsToSave);
    } else {
       await Promise.all(uniqueItemsToSave.map(item => this.inventoryRepository.save(item)));
    }
  }
}
