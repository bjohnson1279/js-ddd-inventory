import { IInventoryAuditRepository } from "../../domain/repositories/IInventoryAuditRepository";

export interface RecordAuditCountDTO {
  auditId: string;
  variantId: string;
  countedQuantity: number;
}

export class RecordAuditCount {
  constructor(private readonly auditRepository: IInventoryAuditRepository) {}

  async execute(dto: RecordAuditCountDTO): Promise<void> {
    const audit = await this.auditRepository.findById(dto.auditId);
    if (!audit) {
      throw new Error(`Inventory audit with ID ${dto.auditId} not found.`);
    }

    audit.recordCount(dto.variantId, dto.countedQuantity);
    await this.auditRepository.save(audit);
  }
}
