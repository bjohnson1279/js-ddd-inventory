import { IInventoryAuditRepository } from "../../domain/repositories/IInventoryAuditRepository";

export class StartInventoryAudit {
  constructor(private readonly auditRepository: IInventoryAuditRepository) {}

  async execute(auditId: string): Promise<void> {
    const audit = await this.auditRepository.findById(auditId);
    if (!audit) {
      throw new Error(`Inventory audit with ID ${auditId} not found.`);
    }

    audit.start();
    await this.auditRepository.save(audit);
  }
}
