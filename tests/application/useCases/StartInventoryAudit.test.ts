import { StartInventoryAudit } from "../../../src/application/useCases/StartInventoryAudit";
import { InMemoryInventoryAuditRepository } from "../../../src/infrastructure/database/InMemoryInventoryAuditRepository";
import { InventoryAudit } from "../../../src/domain/procurement/aggregates/InventoryAudit";
import { AuditStatus } from "../../../src/domain/procurement/enums/AuditStatus";
import { InventoryAuditItem } from "../../../src/domain/procurement/aggregates/InventoryAuditItem";

describe("StartInventoryAudit Use Case", () => {
  let repository: InMemoryInventoryAuditRepository;
  let useCase: StartInventoryAudit;

  beforeEach(() => {
    repository = new InMemoryInventoryAuditRepository();
    useCase = new StartInventoryAudit(repository);
  });

  it("should start an existing draft audit", async () => {
    const auditId = "audit-1";
    const audit = new InventoryAudit(auditId, "AUD-001", "TEN-1", "loc-1", AuditStatus.Draft, []);
    await repository.save(audit);

    await useCase.execute(auditId);

    const updatedAudit = await repository.findById(auditId);
    expect(updatedAudit).not.toBeNull();
    expect(updatedAudit?.status).toBe(AuditStatus.InProgress);
  });

  it("should throw an error if the audit does not exist", async () => {
    await expect(useCase.execute("non-existent-id")).rejects.toThrow(/not found/i);
  });
});
