import { IPurchaseOrderRepository } from "../../domain/repositories/IPurchaseOrderRepository";
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { ReceiveStock, ReceiveStockInput } from "./ReceiveStock";
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

    // Optimization: Index purchase order items by variantId to prevent O(N*M) nested lookups
    const poItemsMap = new Map(po.items.map((i) => [i.variantId, i]));

    const batchInputs: ReceiveStockInput[] = [];
    const costLayers: InventoryCostLayer[] = [];

    for (const item of dto.items) {
      const poItem = poItemsMap.get(item.variantId);
      if (!poItem) {
        throw new Error(`Item ${item.variantId} not found in purchase order ${po.purchaseOrderNumber}.`);
      }

      // 1. Update PO received quantity & state
      po.receiveItems(item.variantId, item.quantityReceived);

      // 2. Queue for bulk execution
      batchInputs.push({
        skuStr: item.variantId,
        amount: item.quantityReceived,
        locationId: po.locationId
      });

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

    // Execute bulk updates in one batch to eliminate N+1 query issue inside loop
    await receiveStock.executeBatch(batchInputs);

    const savePromises: Promise<any>[] = [];

    if (this.costLayerRepository.saveMany && costLayers.length > 0) {
      savePromises.push(this.costLayerRepository.saveMany(costLayers));
    } else {
      savePromises.push(...costLayers.map(layer => this.costLayerRepository.save(layer)));
    }

    // 4. Save updated PO concurrently with cost layers
    savePromises.push(this.poRepository.save(po));

    await Promise.all(savePromises);
  }
}
