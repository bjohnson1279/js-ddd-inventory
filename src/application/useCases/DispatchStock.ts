import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { IExternalInventoryPublisher } from "../ports/IExternalInventoryPublisher";
import { ReorderPolicyService } from "../../domain/procurement/services/ReorderPolicyService";

export class DispatchStock {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly externalPublisher?: IExternalInventoryPublisher,
    private readonly reorderPolicyService?: ReorderPolicyService
  ) {}

  async execute(skuStr: string, amount: number, locationId: string = "default", skipPublishing: boolean = false): Promise<void> {
    const sku = SKU.create(skuStr);
    const quantityToSubtract = Quantity.create(amount);

    const item = await this.inventoryRepository.findBySku(sku, locationId);

    if (!item) {
      throw new Error("Item not found in inventory");
    }

    item.dispatchStock(quantityToSubtract);

    await this.inventoryRepository.save(item);

    if (this.reorderPolicyService) {
      await this.reorderPolicyService.checkPolicy(skuStr, locationId, item.quantity.getValue());
    }

    if (this.externalPublisher && !skipPublishing) {
      await this.externalPublisher.publishStockLevel(sku, item.quantity);
    }
  }
}
