import { PurchaseOrder } from "../procurement/aggregates/PurchaseOrder";

export interface IPurchaseOrderRepository {
  findById(id: string): Promise<PurchaseOrder | null>;
  findByNumber(poNumber: string): Promise<PurchaseOrder | null>;
  findAll(): Promise<PurchaseOrder[]>;
  save(po: PurchaseOrder): Promise<void>;
}
