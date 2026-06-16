import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
import { IExternalInventoryPublisher } from "../ports/IExternalInventoryPublisher";
import { WMSCapacityService } from "../../domain/services/WMSCapacityService";

export class ReceiveStock {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly externalPublisher?: IExternalInventoryPublisher,
    private readonly capacityService?: WMSCapacityService
  ) {}

  async execute(skuStr: string, amount: number, locationId: string = "default"): Promise<void> {
    const sku = SKU.create(skuStr);
    const quantityToAdd = Quantity.create(amount);

    if (this.capacityService) {
      await this.capacityService.validateCapacity(locationId, [
        { sku: skuStr, mode: "relative", quantity: amount }
      ]);
    }

    let item = await this.inventoryRepository.findBySku(sku, locationId);

    if (!item) {
      // If item does not exist, create it with ID as a simple string for now
      item = InventoryItem.create(Date.now().toString(), sku, locationId, Quantity.create(0));
    }

    item.receiveStock(quantityToAdd);

    await this.inventoryRepository.save(item);

    if (this.externalPublisher) {
      await this.externalPublisher.publishStockLevel(sku, item.quantity);
    }
  }
}
