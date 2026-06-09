import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { SKU } from "../../domain/valueObjects/SKU";

export class GetStockLevel {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(skuStr: string, locationId: string = "default"): Promise<number> {
    const sku = SKU.create(skuStr);
    const item = await this.inventoryRepository.findBySku(sku, locationId);

    if (!item) {
      return 0; // Or throw error, but returning 0 makes sense for an empty inventory
    }

    return item.quantity.getValue();
  }
}
