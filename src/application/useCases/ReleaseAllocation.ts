import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";

export class ReleaseAllocation {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(skuStr: string, amount: number, locationId: string = "default"): Promise<void> {
    const sku = SKU.create(skuStr);
    const quantityToRelease = Quantity.create(amount);

    const item = await this.inventoryRepository.findBySku(sku, locationId);

    if (!item) {
      throw new Error(`Inventory item for SKU ${skuStr} at location ${locationId} not found.`);
    }

    item.releaseAllocation(quantityToRelease);

    await this.inventoryRepository.save(item);
  }
}
