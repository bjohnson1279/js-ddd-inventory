import { IInventoryAuditRepository } from "../../domain/repositories/IInventoryAuditRepository";
import { InventoryAudit } from "../../domain/procurement/aggregates/InventoryAudit";

export class InMemoryInventoryAuditRepository implements IInventoryAuditRepository {
  private readonly audits: Map<string, InventoryAudit> = new Map();

  async findById(id: string): Promise<InventoryAudit | null> {
    return this.audits.get(id) ?? null;
  }

  async findByNumber(auditNumber: string): Promise<InventoryAudit | null> {
    for (const audit of this.audits.values()) {
      if (audit.auditNumber === auditNumber) {
        return audit;
      }
    }
    return null;
  }

  async findAll(): Promise<InventoryAudit[]> {
    return Array.from(this.audits.values());
  }

  async save(audit: InventoryAudit): Promise<void> {
    this.audits.set(audit.id, audit);
  }
}
