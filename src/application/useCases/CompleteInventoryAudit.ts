import { IInventoryAuditRepository } from "../../domain/repositories/IInventoryAuditRepository";

export class CompleteInventoryAudit {
  constructor(private readonly auditRepository: IInventoryAuditRepository) {}

  async execute(auditId: string): Promise<void> {
    if (!auditId || auditId.trim() === '') {
      throw new Error("Invalid audit ID provided.");
    }

    const audit = await this.auditRepository.findById(auditId);
    if (!audit) {
      throw new Error(`Inventory audit with ID ${auditId} not found.`);
    }

    audit.complete();
    await this.auditRepository.save(audit);
  }
}
