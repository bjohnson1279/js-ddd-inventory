import { PurchaseOrderStatus } from "../../domain/procurement/enums/PurchaseOrderStatus";
import { IPurchaseOrderRepository } from "../../domain/repositories/IPurchaseOrderRepository";
import { PurchaseOrder } from "../../domain/procurement/aggregates/PurchaseOrder";

export class InMemoryPurchaseOrderRepository implements IPurchaseOrderRepository {
  private readonly pos: Map<string, PurchaseOrder> = new Map();

  async findById(id: string): Promise<PurchaseOrder | null> {
    return this.pos.get(id) ?? null;
  }

  async findByNumber(poNumber: string): Promise<PurchaseOrder | null> {
    for (const po of this.pos.values()) {
      if (po.purchaseOrderNumber === poNumber) {
        return po;
      }
    }
    return null;
  }

  async findAll(): Promise<PurchaseOrder[]> {
    return Array.from(this.pos.values());
  }

  async findPendingByTenantAndLocationAndVariant(tenantId: string, locationId: string, variantId: string): Promise<PurchaseOrder[]> {
    const allPos = Array.from(this.pos.values());
    return allPos.filter(po => {
      if (po.tenantId !== tenantId || po.locationId !== locationId) return false;
      if (
        po.status === PurchaseOrderStatus.Draft ||
        po.status === PurchaseOrderStatus.Approved ||
        po.status === PurchaseOrderStatus.Sent
      ) {
        return po.items.some(item => item.variantId === variantId && item.receivedQuantity < item.quantity);
      }
      return false;
    });
  }

  async findReceivedByTenantAndVariant(tenantId: string, variantId: string, locationId?: string): Promise<PurchaseOrder[]> {
    const allPos = Array.from(this.pos.values());
    return allPos.filter(po => {
      if (po.tenantId !== tenantId) return false;
      if (locationId && po.locationId !== locationId) return false;
      if (po.status === PurchaseOrderStatus.Received) {
        return po.items.some(item => item.variantId === variantId);
      }
      return false;
    });
  }

  async save(po: PurchaseOrder): Promise<void> {
    this.pos.set(po.id, po);
  }
}
