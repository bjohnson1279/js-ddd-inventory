import { batchSave } from "../../utils/batchSave";
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

    // Optimization: Bulk pre-fetch inventory items to avoid N+1 queries.
    const skusToFetch = dto.items.map(i => SKU.create(i.variantId));

    const preFetchedItems = new Map<string, InventoryItem>();
    const preFetchedKeys = new Set<string>();

    if (skusToFetch.length > 0) {
      for (const sku of skusToFetch) {
        preFetchedKeys.add(sku.getValue());
      }

      if (this.inventoryRepository.findBySkus) {
        const items = await this.inventoryRepository.findBySkus(skusToFetch, po.locationId);
        for (const item of items) {
          preFetchedItems.set(item.sku.getValue(), item);
        }
      } else {
        for (const sku of skusToFetch) {
          const item = await this.inventoryRepository.findBySku(sku, po.locationId);
          if (item) {
            preFetchedItems.set(item.sku.getValue(), item);
          }
        }
      }
    }

    const inventoryItemsToSave = new Map<string, InventoryItem>();

    for (const item of dto.items) {
      const poItem = poItemsMap.get(item.variantId);
      if (!poItem) {
        throw new Error(`Item ${item.variantId} not found in purchase order ${po.purchaseOrderNumber}.`);
      }

      // 1. Update PO received quantity & state
      po.receiveItems(item.variantId, item.quantityReceived);

      // 2. Receive physical stock safely without N+1 queries
      const sku = SKU.create(item.variantId);
      let invItem = inventoryItemsToSave.get(sku.getValue()) || preFetchedItems.get(sku.getValue()) || null;
      if (!invItem && !preFetchedKeys.has(sku.getValue())) {
        invItem = await this.inventoryRepository.findBySku(sku, po.locationId);
      }

      if (!invItem) {
        invItem = InventoryItem.create(
          crypto.randomUUID(),
          sku,
          po.locationId,
          Quantity.create(0)
        );
      }

      invItem.receiveStock(Quantity.create(item.quantityReceived));
      inventoryItemsToSave.set(sku.getValue(), invItem);

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

    // Save updated PO concurrently with cost layers and inventory items
    await Promise.all([
      batchSave(this.inventoryRepository, Array.from(inventoryItemsToSave.values())),
      batchSave(this.costLayerRepository, costLayers),
      this.poRepository.save(po)
    ]);
  }
}
