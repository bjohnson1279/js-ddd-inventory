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

    const itemMap = new Map<string, InventoryItem | null>();
    items.forEach((item, index) => {
        itemMap.set(item.variantId, fetchedItems[index]);
    });

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

    await Promise.all(savePromises);
  }
}
