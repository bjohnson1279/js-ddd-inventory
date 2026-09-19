import { PurchaseOrder } from "../procurement/aggregates/PurchaseOrder";

export interface IPurchaseOrderRepository {
  findById(id: string): Promise<PurchaseOrder | null>;
  findByNumber(poNumber: string): Promise<PurchaseOrder | null>;
  findAll(): Promise<PurchaseOrder[]>;
  findPendingByTenantAndLocationAndVariant(tenantId: string, locationId: string, variantId: string): Promise<PurchaseOrder[]>;
  findReceivedByTenantAndVariant(tenantId: string, variantId: string, locationId?: string): Promise<PurchaseOrder[]>;
  save(po: PurchaseOrder): Promise<void>;
}
