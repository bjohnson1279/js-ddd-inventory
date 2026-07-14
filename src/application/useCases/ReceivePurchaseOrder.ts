import { IPurchaseOrderRepository } from "../../domain/repositories/IPurchaseOrderRepository";
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { InventoryCostLayer } from "../../domain/accounting/entities/InventoryCostLayer";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
import crypto from "crypto";

export interface ReceivePurchaseOrderItemDTO {
  variantId: string;
  quantityReceived: number;
}

export interface ReceivePurchaseOrderDTO {
  purchaseOrderId: string;
  items: ReceivePurchaseOrderItemDTO[];
}

export class ReceivePurchaseOrder {
  constructor(
    private readonly poRepository: IPurchaseOrderRepository,
    private readonly inventoryRepository: IInventoryRepository,
    private readonly costLayerRepository: ICostLayerRepository
  ) {}

  async execute(dto: ReceivePurchaseOrderDTO): Promise<void> {
    const po = await this.poRepository.findById(dto.purchaseOrderId);
    if (!po) {
      throw new Error(`Purchase order with ID ${dto.purchaseOrderId} not found.`);
    }

    const costLayers: InventoryCostLayer[] = [];

    // Optimization: Index purchase order items by variantId to prevent O(N*M) nested lookups
    const poItemsMap = new Map(po.items.map((i) => [i.variantId, i]));

    // Optimization: Prefetch all necessary inventory items to avoid N+1 queries and race conditions during concurrent execution
    const skusToFetch = dto.items.map((i) => SKU.create(i.variantId));
    let inventoryItems: InventoryItem[] = [];
    if (skusToFetch.length > 0) {
      inventoryItems = await this.inventoryRepository.findBySkus(skusToFetch, po.locationId);
    }
    const inventoryItemsMap = new Map(inventoryItems.map((i) => [i.sku.getValue(), i]));

    const itemsToSave = new Set<InventoryItem>();

    for (const item of dto.items) {
      const poItem = poItemsMap.get(item.variantId);
      if (!poItem) {
        throw new Error(`Item ${item.variantId} not found in purchase order ${po.purchaseOrderNumber}.`);
      }

      // 1. Update PO received quantity & state
      po.receiveItems(item.variantId, item.quantityReceived);

      // 2. Receive physical stock (in-memory batched accumulation)
      let invItem = inventoryItemsMap.get(item.variantId);
      if (!invItem) {
        invItem = InventoryItem.create(
          crypto.randomUUID(),
          SKU.create(item.variantId),
          po.locationId,
          Quantity.create(0)
        );
        inventoryItemsMap.set(item.variantId, invItem);
      }
      invItem.receiveStock(Quantity.create(item.quantityReceived));
      itemsToSave.add(invItem);

      // 3. Prepare Cost Layer
      const layerId = crypto.randomUUID();
      const costLayer = new InventoryCostLayer(
        layerId,
        item.variantId,
        po.tenantId,
        item.quantityReceived,
        poItem.unitCostCents,
        new Date(),
        po.id,
        po.locationId
      );
      costLayers.push(costLayer);
    }

    if (itemsToSave.size > 0) {
      await this.inventoryRepository.saveMany(Array.from(itemsToSave));
    }

    if (costLayers.length > 0) {
      await this.costLayerRepository.saveMany(costLayers);
    }

    // 4. Save updated PO
    await this.poRepository.save(po);
  }
}
