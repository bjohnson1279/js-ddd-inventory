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
    for (const item of onboarding.getItems()) {
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

    // --- Pass 2: Post ledger entries ---
    // In this simplified implementation, we update/create InventoryItems.
    // In a full implementation, we would append to a ledger.
    for (const item of onboarding.getItems()) {
      // Assuming variantId is used as SKU for simplicity in this draft
      const sku = SKU.create(item.variantId);
      let inventoryItem = await this.inventoryRepository.findBySku(sku);

      if (!inventoryItem) {
        inventoryItem = InventoryItem.create(
          Date.now().toString() + Math.random(),
          sku,
          Quantity.create(0)
        );
      }

      inventoryItem.reconcileCount(Quantity.create(item.quantity));
      await this.inventoryRepository.save(inventoryItem);

      // In a real system, we'd also record the unit cost and emit events
    }
  }
}
