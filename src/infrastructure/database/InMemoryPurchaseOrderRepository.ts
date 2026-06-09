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

  async save(po: PurchaseOrder): Promise<void> {
    this.pos.set(po.id, po);
  }
}
