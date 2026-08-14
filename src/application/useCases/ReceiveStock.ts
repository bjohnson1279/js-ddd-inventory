import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
import { IExternalInventoryPublisher } from "../ports/IExternalInventoryPublisher";
import { WMSCapacityService } from "../../domain/services/WMSCapacityService";
import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { IProductRepository } from "../../domain/repositories/IProductRepository";
import { InventoryCostLayer } from "../../domain/accounting/entities/InventoryCostLayer";

export class ReceiveStock {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly externalPublisher?: IExternalInventoryPublisher,
    private readonly capacityService?: WMSCapacityService,
    private readonly productRepository?: IProductRepository,
    private readonly costLayerRepository?: ICostLayerRepository
  ) {}

  async execute(
    skuStr: string,
    amount: number,
    locationId: string = "default",
    unitCostCents?: number,
    lotNumber?: string,
    expirationDate?: Date,
    tenantId?: string,
    purchaseOrderId?: string
  ): Promise<void> {
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

    // If cost layer repository and product repository are provided, create cost layer
    if (this.costLayerRepository && this.productRepository && unitCostCents !== undefined) {
      const product = await this.productRepository.findBySku(sku);
      if (!product) {
        throw new Error(`Product with SKU ${skuStr} not found.`);
      }
      const variant = product.findVariantBySku(skuStr);
      if (!variant) {
        throw new Error(`Variant with SKU ${skuStr} not found.`);
      }

      const layerId = crypto.randomUUID();
      const layer = new InventoryCostLayer(
        layerId,
        variant.id,
        tenantId || "default-tenant",
        amount,
        unitCostCents,
        new Date(),
        purchaseOrderId || "DIRECT-RECEIPT",
        locationId,
        lotNumber,
        expirationDate
      );
      await this.costLayerRepository.save(layer);
    }

    if (this.externalPublisher) {
      await this.externalPublisher.publishStockLevel(sku, item.quantity);
    }
  }
}
