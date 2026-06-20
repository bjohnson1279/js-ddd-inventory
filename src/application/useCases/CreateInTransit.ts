import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
import crypto from "crypto";

export class CreateInTransit {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(skuStr: string, amount: number, locationId: string = "default"): Promise<void> {
    const sku = SKU.create(skuStr);
    const quantityToTransit = Quantity.create(amount);

    let item = await this.inventoryRepository.findBySku(sku, locationId);

    if (!item) {
      item = InventoryItem.create(crypto.randomUUID().toString(), sku, locationId, Quantity.create(0));
    }

    item.createInTransit(quantityToTransit);

    await this.inventoryRepository.save(item);
  }
}
