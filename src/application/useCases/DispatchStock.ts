import { batchSave } from "../../utils/batchSave";
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { IExternalInventoryPublisher } from "../ports/IExternalInventoryPublisher";
import { ReorderPolicyService } from "../../domain/procurement/services/ReorderPolicyService";
import { IDispatchRecordRepository, DispatchRecord } from "../../domain/repositories/IDispatchRecordRepository";
import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { IProductRepository } from "../../domain/repositories/IProductRepository";
import { InventoryCostLayer } from "../../domain/accounting/entities/InventoryCostLayer";

export class DispatchStock {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly externalPublisher?: IExternalInventoryPublisher,
    private readonly reorderPolicyService?: ReorderPolicyService,
    private readonly dispatchRecordRepository?: IDispatchRecordRepository,
    private readonly productRepository?: IProductRepository,
    private readonly costLayerRepository?: ICostLayerRepository
  ) {}

  async execute(
    skuStr: string,
    amount: number,
    locationId: string = "default",
    skipPublishing: boolean = false,
    lotNumber?: string
  ): Promise<void> {
    const sku = SKU.create(skuStr);
    const quantityToSubtract = Quantity.create(amount);

    const item = await this.inventoryRepository.findBySku(sku, locationId);

    if (!item) {
      throw new Error("Item not found in inventory");
    }

    // Read and validate the requested lot before changing stock or consuming layers.
    let activeLayers: InventoryCostLayer[] | undefined;
    if (this.costLayerRepository && this.productRepository) {
      const product = await this.productRepository.findBySku(sku);
      if (product) {
        const variant = product.findVariantBySku(skuStr);
        if (variant) {
          activeLayers = await this.costLayerRepository.getActiveLayers(variant.id, "expiration_date ASC");
          if (lotNumber && activeLayers.filter(layer => layer.lotNumber === lotNumber)
            .reduce((available, layer) => available + layer.remainingQuantity, 0) < amount) {
            throw new Error(`Insufficient stock in lot ${lotNumber} to dispatch ${amount} units.`);
          }
        }
      }
    }

    item.dispatchStock(quantityToSubtract);
    await this.inventoryRepository.save(item);

    if (activeLayers && this.costLayerRepository) {
      const targetLayers = lotNumber ? activeLayers.filter(layer => layer.lotNumber === lotNumber) : activeLayers;
      let remaining = amount;
      for (const layer of targetLayers) {
        if (remaining <= 0) break;
        const consumed = layer.consume(remaining);
        remaining -= consumed;
        if (this.dispatchRecordRepository && consumed > 0) {
          await this.dispatchRecordRepository.save(
            new DispatchRecord("", skuStr, locationId, consumed, new Date(), layer.lotNumber)
          );
        }
      }
      await batchSave(this.costLayerRepository, activeLayers);
    } else if (!this.costLayerRepository || !this.productRepository) {
      // Record historical dispatch for velocity tracking and demand forecasting
      if (this.dispatchRecordRepository) {
        await this.dispatchRecordRepository.save(
          new DispatchRecord("", skuStr, locationId, amount, new Date(), lotNumber)
        );
      }
    }

    if (this.reorderPolicyService) {
      await this.reorderPolicyService.checkPolicy(skuStr, locationId, item.quantity.getValue());
    }

    if (this.externalPublisher && !skipPublishing) {
      await this.externalPublisher.publishStockLevel(sku, item.quantity);
    }
  }
}
