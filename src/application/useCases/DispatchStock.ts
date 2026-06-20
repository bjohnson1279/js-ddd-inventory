import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { IExternalInventoryPublisher } from "../ports/IExternalInventoryPublisher";
import { ReorderPolicyService } from "../../domain/procurement/services/ReorderPolicyService";
import { IDispatchRecordRepository, DispatchRecord } from "../../domain/repositories/IDispatchRecordRepository";
import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { IProductRepository } from "../../domain/repositories/IProductRepository";

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

    item.dispatchStock(quantityToSubtract);

    await this.inventoryRepository.save(item);

    // Consume cost layers and record lot-specific dispatches
    if (this.costLayerRepository && this.productRepository) {
      const product = await this.productRepository.findBySku(sku);
      if (product) {
        const variant = product.variants.find((v) => v.sku.getValue() === skuStr);
        if (variant) {
          const activeLayers = await this.costLayerRepository.getActiveLayers(variant.id, "expiration_date ASC");
          const targetLayers = lotNumber
            ? activeLayers.filter((l) => l.lotNumber === lotNumber)
            : activeLayers;

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

          if (remaining > 0 && lotNumber) {
            throw new Error(`Insufficient stock in lot ${lotNumber} to dispatch ${amount} units.`);
          }

          const costRepo = this.costLayerRepository;
          if (costRepo.saveMany) {
            await costRepo.saveMany(activeLayers);
          } else {
            await Promise.all(activeLayers.map((l) => costRepo.save(l)));
          }
        }
      }
    } else {
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
