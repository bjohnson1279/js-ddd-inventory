import { StartInventoryAudit } from "../../../src/application/useCases/StartInventoryAudit";
import { IInventoryAuditRepository } from "../../../src/domain/repositories/IInventoryAuditRepository";
import { InventoryAudit } from "../../../src/domain/procurement/aggregates/InventoryAudit";
import { AuditStatus } from "../../../src/domain/procurement/enums/AuditStatus";
import { InventoryAuditItem } from "../../../src/domain/procurement/aggregates/InventoryAuditItem";

describe("StartInventoryAudit Use Case", () => {
  let auditRepository: jest.Mocked<IInventoryAuditRepository>;
  let startInventoryAudit: StartInventoryAudit;

  beforeEach(() => {
    auditRepository = {
      findById: jest.fn(),
      findByNumber: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<IInventoryAuditRepository>;

    startInventoryAudit = new StartInventoryAudit(auditRepository);
  });

  it("should successfully start a draft inventory audit", async () => {
    const auditId = "audit-123";
    const auditItem = new InventoryAuditItem("item-1", "variant-1", 10, null, false);
    const audit = new InventoryAudit(
      auditId,
      "AUD-123",
      "tenant-1",
      "loc-1",
      AuditStatus.Draft,

      [auditItem]
    );

    auditRepository.findById.mockResolvedValue(audit);

    await startInventoryAudit.execute(auditId);

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(audit.status).toBe(AuditStatus.InProgress);
    expect(auditRepository.save).toHaveBeenCalledWith(audit);
  });

  it("should throw an error if the inventory audit is not found", async () => {
    const auditId = "audit-404";
    auditRepository.findById.mockResolvedValue(null);

    await expect(startInventoryAudit.execute(auditId)).rejects.toThrow(
      `Inventory audit with ID ${auditId} not found.`
    );

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(auditRepository.save).not.toHaveBeenCalled();
  });

  it("should throw an error if the audit is not in draft status", async () => {
    const auditId = "audit-in-progress";
    const audit = new InventoryAudit(
      auditId,
      "AUD-IN-PROG",
      "tenant-1",
      "loc-1",
      AuditStatus.InProgress,

    );

    auditRepository.findById.mockResolvedValue(audit);

    await expect(startInventoryAudit.execute(auditId)).rejects.toThrow(
      "Only draft audits can be started."
    );

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(auditRepository.save).not.toHaveBeenCalled();
  });

  it("should propagate errors thrown by auditRepository.findById", async () => {
    const auditId = "audit-123";
    const dbError = new Error("Database connection failed");
    auditRepository.findById.mockRejectedValue(dbError);

    await expect(startInventoryAudit.execute(auditId)).rejects.toThrow(
      "Database connection failed"
    );

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(auditRepository.save).not.toHaveBeenCalled();
  });

  it("should propagate errors thrown by auditRepository.save", async () => {
    const auditId = "audit-123";
    const audit = new InventoryAudit(
      auditId,
      "AUD-123",
      "tenant-1",
      "loc-1",
      AuditStatus.Draft,

    );

    auditRepository.findById.mockResolvedValue(audit);
    const dbError = new Error("Database write failed");
    auditRepository.save.mockRejectedValue(dbError);

    await expect(startInventoryAudit.execute(auditId)).rejects.toThrow(
      "Database write failed"
    );

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(audit.status).toBe(AuditStatus.InProgress);
    expect(auditRepository.save).toHaveBeenCalledWith(audit);
  });
});
