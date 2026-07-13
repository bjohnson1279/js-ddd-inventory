import { CompleteInventoryAudit } from "../../../src/application/useCases/CompleteInventoryAudit";
import { IInventoryAuditRepository } from "../../../src/domain/repositories/IInventoryAuditRepository";
import { InventoryAudit } from "../../../src/domain/procurement/aggregates/InventoryAudit";
import { AuditStatus } from "../../../src/domain/procurement/enums/AuditStatus";
import { InventoryAuditItem } from "../../../src/domain/procurement/aggregates/InventoryAuditItem";

describe("CompleteInventoryAudit Use Case", () => {
  let auditRepository: jest.Mocked<IInventoryAuditRepository>;
  let completeInventoryAudit: CompleteInventoryAudit;

  beforeEach(() => {
    auditRepository = {
      findById: jest.fn(),
      findByNumber: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<IInventoryAuditRepository>;

    completeInventoryAudit = new CompleteInventoryAudit(auditRepository);
  });

  it("should successfully complete an in-progress inventory audit", async () => {
    const auditId = "audit-123";
    const auditItem = new InventoryAuditItem("item-1", "variant-1", 10, 10, true);
    const audit = new InventoryAudit(
      auditId,
      "AUD-123",
      "tenant-1",
      "loc-1",
      AuditStatus.InProgress,
      [auditItem]
    );

    auditRepository.findById.mockResolvedValue(audit);

    await completeInventoryAudit.execute(auditId);

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(audit.status).toBe(AuditStatus.Completed);
    expect(auditRepository.save).toHaveBeenCalledWith(audit);
  });

  it("should throw an error if the inventory audit is not found", async () => {
    const auditId = "audit-404";
    auditRepository.findById.mockResolvedValue(null);

    await expect(completeInventoryAudit.execute(auditId)).rejects.toThrow(
      `Inventory audit with ID ${auditId} not found.`
    );

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(auditRepository.save).not.toHaveBeenCalled();
  });

  it("should throw an error if the audit is not in-progress", async () => {
    const auditId = "audit-draft";
    const audit = new InventoryAudit(
      auditId,
      "AUD-DRAFT",
      "tenant-1",
      "loc-1",
      AuditStatus.Draft,
      []
    );

    auditRepository.findById.mockResolvedValue(audit);

    await expect(completeInventoryAudit.execute(auditId)).rejects.toThrow(
      "Only in-progress audits can be completed."
    );

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(auditRepository.save).not.toHaveBeenCalled();
  });

  it("should throw an error if some items have not been counted", async () => {
    const auditId = "audit-uncounted";
    const auditItem = new InventoryAuditItem("item-2", "variant-2", 10, null, false);
    const audit = new InventoryAudit(
      auditId,
      "AUD-UNC",
      "tenant-1",
      "loc-1",
      AuditStatus.InProgress,
      [auditItem]
    );

    auditRepository.findById.mockResolvedValue(audit);

    await expect(completeInventoryAudit.execute(auditId)).rejects.toThrow(
      "Cannot complete audit: some items have not been counted."
    );

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(auditRepository.save).not.toHaveBeenCalled();
  });
});
