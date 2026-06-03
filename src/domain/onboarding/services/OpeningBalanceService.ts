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

    // --- Pass 1: Guard against duplicate opening balances ---
    const checkPromises = onboarding.getItems().map(async (item) => {
      const exists = await this.inventoryRepository.hasAnyEntries(
        item.variantId,
        onboarding.locationId
      );
      if (exists) {
        throw new Error(
          `Opening balance conflict for variant ${item.variantId} at location ${onboarding.locationId}`
        );
      }
    });

    await Promise.all(checkPromises);

    // --- Pass 2: Fetch all necessary items concurrently ---
    const items = onboarding.getItems();
    const fetchPromises = items.map(item => this.inventoryRepository.findBySku(SKU.create(item.variantId)));
    const fetchedItems = await Promise.all(fetchPromises);

    // --- Post ledger entries ---
    // In this simplified implementation, we update/create InventoryItems.
    // In a full implementation, we would append to a ledger.
    const itemMap = new Map<string, InventoryItem>();

    for (const { item, sku, inventoryItem: existingItem } of itemsData) {
      const skuValue = sku.getValue();
      let inventoryItem = existingItem;

    // --- Pass 3: Post ledger entries ---
    const savePromises: Promise<void>[] = [];

    for (const item of items) {
      const skuValue = item.variantId;
      const sku = SKU.create(skuValue);
      let inventoryItem = itemMap.get(skuValue) || null;

      inventoryItem ??= InventoryItem.create(
        Date.now().toString() + Math.random(),
        sku,
        Quantity.create(0)
      );

      inventoryItem.reconcileCount(Quantity.create(item.quantity));
      savePromises.push(this.inventoryRepository.save(inventoryItem));
    }

    const uniqueItemsToSave = Array.from(itemMap.values());

    if (this.inventoryRepository.saveMany && uniqueItemsToSave.length > 0) {
       await this.inventoryRepository.saveMany(uniqueItemsToSave as InventoryItem[]);
    } else {
       await Promise.all(uniqueItemsToSave.map(item => this.inventoryRepository.save(item)));
    }
  }
}
