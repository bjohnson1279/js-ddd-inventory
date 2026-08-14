import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
import { IExternalInventoryPublisher } from "../ports/IExternalInventoryPublisher";
import { WMSCapacityService } from "../../domain/services/WMSCapacityService";
import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { IProductRepository } from "../../domain/repositories/IProductRepository";
import { InventoryCostLayer } from "../../domain/accounting/entities/InventoryCostLayer";

export interface ReceiveStockInput {
  skuStr: string;
  amount: number;
  locationId?: string;
  unitCostCents?: number;
  lotNumber?: string;
  expirationDate?: Date;
  tenantId?: string;
  purchaseOrderId?: string;
}

export class ReceiveStock {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly externalPublisher?: IExternalInventoryPublisher,
    private readonly capacityService?: WMSCapacityService,
    private readonly productRepository?: IProductRepository,
    private readonly costLayerRepository?: ICostLayerRepository
  ) {}

  async executeBatch(inputs: ReceiveStockInput[]): Promise<void> {
    if (inputs.length === 0) return;

    if (this.capacityService) {
      const byLocation = new Map<string, { sku: string; mode: "relative"; quantity: number }[]>();
      for (const input of inputs) {
        const loc = input.locationId || "default";
        if (!byLocation.has(loc)) byLocation.set(loc, []);
        byLocation.get(loc)!.push({ sku: input.skuStr, mode: "relative" as const, quantity: input.amount });
      }
      for (const [locId, adjustments] of byLocation.entries()) {
        await this.capacityService!.validateCapacity(locId, adjustments);
      }
    }

    const byLocationItems = new Map<string, ReceiveStockInput[]>();
    for (const input of inputs) {
      const loc = input.locationId || "default";
      if (!byLocationItems.has(loc)) byLocationItems.set(loc, []);
      byLocationItems.get(loc)!.push(input);
    }

    const itemsToSave = new Map<string, InventoryItem>();
    const costLayersToSave: InventoryCostLayer[] = [];
    const publishEvents: { sku: SKU; quantity: Quantity }[] = [];

    const variantsMap = new Map<string, any>();
    if (this.costLayerRepository && this.productRepository) {
      const productSkus = inputs
        .filter(i => i.unitCostCents !== undefined)
        .map(i => SKU.create(i.skuStr));
      if (productSkus.length > 0) {
        const products = await this.productRepository.findBySkus(productSkus);
        for (const product of products) {
          for (const variant of product.variants) {
            variantsMap.set(variant.sku.getValue(), variant);
          }
        }
      }
    }

    for (const [locationId, locInputs] of byLocationItems.entries()) {
      const skus = locInputs.map(i => SKU.create(i.skuStr));
      let existingItems: InventoryItem[] = [];
      if (this.inventoryRepository.findBySkus) {
        existingItems = await this.inventoryRepository.findBySkus(skus, locationId);
      } else {
        const results = await Promise.all(skus.map(sku => this.inventoryRepository.findBySku(sku, locationId)));
        existingItems = results.filter((item): item is InventoryItem => item !== null);
      }

      const existingMap = new Map<string, InventoryItem>();
      for (const item of existingItems) {
        if (item) existingMap.set(item.sku.getValue(), item);
      }

      for (const input of locInputs) {
        const sku = SKU.create(input.skuStr);
        const quantityToAdd = Quantity.create(input.amount);
        const itemKey = `${locationId}:${input.skuStr}`;

        let item = itemsToSave.get(itemKey) || existingMap.get(input.skuStr);

        if (!item) {
          item = InventoryItem.create(Date.now().toString() + Math.random().toString(), sku, locationId, Quantity.create(0));
        }

        item.receiveStock(quantityToAdd);
        itemsToSave.set(itemKey, item);

        if (this.costLayerRepository && this.productRepository && input.unitCostCents !== undefined) {
          const variant = variantsMap.get(input.skuStr);
          if (!variant) {
            throw new Error(`Variant with SKU ${input.skuStr} not found.`);
          }
          const layerId = crypto.randomUUID();
          const layer = new InventoryCostLayer(
            layerId,
            variant.id,
            input.tenantId || "default-tenant",
            input.amount,
            input.unitCostCents,
            new Date(),
            input.purchaseOrderId || "DIRECT-RECEIPT",
            locationId,
            input.lotNumber,
            input.expirationDate
          );
          costLayersToSave.push(layer);
        }

        if (this.externalPublisher) {
          publishEvents.push({ sku, quantity: item.quantity });
        }
      }
    }

    const uniqueItems = Array.from(itemsToSave.values());
    if (this.inventoryRepository.saveMany && uniqueItems.length > 0) {
      await this.inventoryRepository.saveMany(uniqueItems);
    } else {
      const chunkSize = 50;
      for (let i = 0; i < uniqueItems.length; i += chunkSize) {
        const chunk = uniqueItems.slice(i, i + chunkSize);
        await Promise.all(chunk.map(item => this.inventoryRepository.save(item)));
      }
    }

    if (this.costLayerRepository && costLayersToSave.length > 0) {
      if (this.costLayerRepository.saveMany) {
        await this.costLayerRepository.saveMany(costLayersToSave);
      } else {
        const chunkSize = 50;
        for (let i = 0; i < costLayersToSave.length; i += chunkSize) {
          const chunk = costLayersToSave.slice(i, i + chunkSize);
          await Promise.all(chunk.map(layer => this.costLayerRepository!.save(layer)));
        }
      }
    }

    if (this.externalPublisher) {
      for (const event of publishEvents) {
        await this.externalPublisher.publishStockLevel(event.sku, event.quantity);
      }
    }
  }

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
    await this.executeBatch([{
      skuStr, amount, locationId, unitCostCents, lotNumber, expirationDate, tenantId, purchaseOrderId
    }]);
  }
}
