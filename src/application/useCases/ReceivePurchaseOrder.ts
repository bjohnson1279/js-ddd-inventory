import { IPurchaseOrderRepository } from "../../domain/repositories/IPurchaseOrderRepository";
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { ReceiveStock } from "./ReceiveStock";
import { InventoryCostLayer } from "../../domain/accounting/entities/InventoryCostLayer";
import { SKU } from "../../domain/valueObjects/SKU";

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

    const receiveStock = new ReceiveStock(this.inventoryRepository);

    const costLayers: InventoryCostLayer[] = [];

    // Optimization: Index purchase order items by variantId to prevent O(N*M) nested lookups
    const poItemsMap = new Map(po.items.map((i) => [i.variantId, i]));

    // Optimization: Bulk pre-fetch inventory items to avoid N+1 queries.
    // The underlying ReceiveStock use case internally executes `this.inventoryRepository.findBySku`.
    // By invoking `findBySkus` here first, a properly configured repository implementation
    // (such as Prisma with a dataloader/transaction context or an in-memory cache layer)
    // will satisfy the inner queries from memory.
    const skusToFetch = dto.items.map(i => SKU.create(i.variantId));
    if (this.inventoryRepository.findBySkus && skusToFetch.length > 0) {
      await this.inventoryRepository.findBySkus(skusToFetch, po.locationId);
    }

    // Optimization: Iterate sequentially rather than concurrently via Promise.all.
    // Concurrent execution of `receiveStock.execute(...)` results in race conditions
    // where multiple updates to the same SKU overwrite each other due to fetching
    // stale optimistic locks simultaneously. Sequential execution guarantees safety
    // at the slight cost of synchronous await steps, offset by the pre-fetch optimization.
    for (const item of dto.items) {
      const poItem = poItemsMap.get(item.variantId);
      if (!poItem) {
        throw new Error(`Item ${item.variantId} not found in purchase order ${po.purchaseOrderNumber}.`);
      }

      // 1. Update PO received quantity & state
      po.receiveItems(item.variantId, item.quantityReceived);

      // 2. Receive physical stock safely using the underlying use case rules
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
