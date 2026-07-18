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

    // Optimization: Pre-fetch all required inventory items in batches to avoid N+1 DB lookups
    const skusToFetch = Array.from(new Set(dto.items.map(i => i.variantId))).map(v => SKU.create(v));
    const inventoryItemsMap = new Map<string, InventoryItem>();

    if (this.inventoryRepository.findBySkus && skusToFetch.length > 0) {
      const fetched = await this.inventoryRepository.findBySkus(skusToFetch, po.locationId);
      for (const item of fetched) {
        inventoryItemsMap.set(item.sku.getValue(), item);
      }
    } else if (skusToFetch.length > 0) {
      // Fallback if findBySkus is not implemented
      const fetchPromises = skusToFetch.map(async (sku) => {
        const item = await this.inventoryRepository.findBySku(sku, po.locationId);
        if (item) inventoryItemsMap.set(item.sku.getValue(), item);
      });
      await Promise.all(fetchPromises);
    }

    const modifiedInventoryItems = new Map<string, InventoryItem>();

    // Optimization: Replaced Promise.all map loop with sequential for-of loop to avoid DB concurrency exceptions
    for (const item of dto.items) {
      const poItem = poItemsMap.get(item.variantId);
      if (!poItem) {
        throw new Error(`Item ${item.variantId} not found in purchase order ${po.purchaseOrderNumber}.`);
      }

      // 1. Update PO received quantity & state
      po.receiveItems(item.variantId, item.quantityReceived);

      // 2. Receive physical stock
      const sku = SKU.create(item.variantId);
      let invItem = modifiedInventoryItems.get(item.variantId) || inventoryItemsMap.get(item.variantId);

      if (!invItem) {
        invItem = InventoryItem.create(
          crypto.randomUUID(),
          sku,
          po.locationId,
          Quantity.create(0)
        );
      }
      invItem.receiveStock(Quantity.create(item.quantityReceived));
      modifiedInventoryItems.set(item.variantId, invItem);

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

    // Save batch inventory items
    if (modifiedInventoryItems.size > 0) {
      if (this.inventoryRepository.saveMany) {
        await this.inventoryRepository.saveMany(Array.from(modifiedInventoryItems.values()));
      } else {
        await Promise.all(Array.from(modifiedInventoryItems.values()).map(item => this.inventoryRepository.save(item)));
      }
    }

    if (this.costLayerRepository.saveMany && costLayers.length > 0) {
      await this.costLayerRepository.saveMany(costLayers);
    } else {
      await Promise.all(costLayers.map(layer => this.costLayerRepository.save(layer)));
    }

    // 4. Save updated PO
    await this.poRepository.save(po);
  }
}
