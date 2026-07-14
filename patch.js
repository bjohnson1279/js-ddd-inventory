const fs = require('fs');

const file = 'src/application/useCases/ReceivePurchaseOrder.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
`import { IPurchaseOrderRepository } from "../../domain/repositories/IPurchaseOrderRepository";
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { ReceiveStock } from "./ReceiveStock";
import { InventoryCostLayer } from "../../domain/accounting/entities/InventoryCostLayer";`,
`import { IPurchaseOrderRepository } from "../../domain/repositories/IPurchaseOrderRepository";
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { InventoryCostLayer } from "../../domain/accounting/entities/InventoryCostLayer";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
import crypto from "crypto";`
);

code = code.replace(
`    const receiveStock = new ReceiveStock(this.inventoryRepository);

    const costLayers: InventoryCostLayer[] = [];

    // Optimization: Index purchase order items by variantId to prevent O(N*M) nested lookups
    const poItemsMap = new Map(po.items.map((i) => [i.variantId, i]));

    await Promise.all(dto.items.map(async (item) => {
      const poItem = poItemsMap.get(item.variantId);
      if (!poItem) {
        throw new Error(\`Item \${item.variantId} not found in purchase order \${po.purchaseOrderNumber}.\`);
      }

      // 1. Update PO received quantity & state
      po.receiveItems(item.variantId, item.quantityReceived);

      // 2. Receive physical stock
      await receiveStock.execute(item.variantId, item.quantityReceived, po.locationId);

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
    }));`,
`    const costLayers: InventoryCostLayer[] = [];

    // Optimization: Index purchase order items by variantId to prevent O(N*M) nested lookups
    const poItemsMap = new Map(po.items.map((i) => [i.variantId, i]));

    // Optimization: Prefetch all necessary inventory items to avoid N+1 queries and race conditions during concurrent execution
    const skusToFetch = dto.items.map((i) => SKU.create(i.variantId));
    let inventoryItems: InventoryItem[] = [];
    if (this.inventoryRepository.findBySkus && skusToFetch.length > 0) {
      inventoryItems = await this.inventoryRepository.findBySkus(skusToFetch, po.locationId);
    } else if (skusToFetch.length > 0) {
      const results = await Promise.all(
        skusToFetch.map((sku) => this.inventoryRepository.findBySku(sku, po.locationId))
      );
      inventoryItems = results.filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined);
    }
    const inventoryItemsMap = new Map(inventoryItems.map((i) => [i.sku.getValue(), i]));

    const itemsToSave = new Set<InventoryItem>();

    for (const item of dto.items) {
      const poItem = poItemsMap.get(item.variantId);
      if (!poItem) {
        throw new Error(\`Item \${item.variantId} not found in purchase order \${po.purchaseOrderNumber}.\`);
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

    if (this.inventoryRepository.saveMany && itemsToSave.size > 0) {
      await this.inventoryRepository.saveMany(Array.from(itemsToSave));
    } else if (itemsToSave.size > 0) {
      await Promise.all(Array.from(itemsToSave).map((invItem) => this.inventoryRepository.save(invItem)));
    }`
);

fs.writeFileSync(file, code);
