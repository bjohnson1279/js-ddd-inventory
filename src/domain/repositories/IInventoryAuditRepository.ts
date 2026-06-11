import { InventoryAudit } from "../procurement/aggregates/InventoryAudit";

export interface IInventoryAuditRepository {
  findById(id: string): Promise<InventoryAudit | null>;
  findByNumber(auditNumber: string): Promise<InventoryAudit | null>;
  findAll(): Promise<InventoryAudit[]>;
  save(audit: InventoryAudit): Promise<void>;
}
