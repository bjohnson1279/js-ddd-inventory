import { RecordAuditCount } from "../../../src/application/useCases/RecordAuditCount";
import { IInventoryAuditRepository } from "../../../src/domain/repositories/IInventoryAuditRepository";
import { InventoryAudit } from "../../../src/domain/procurement/aggregates/InventoryAudit";
import { AuditStatus } from "../../../src/domain/procurement/enums/AuditStatus";
import { InventoryAuditItem } from "../../../src/domain/procurement/aggregates/InventoryAuditItem";

describe("RecordAuditCount Use Case", () => {
  let auditRepository: jest.Mocked<IInventoryAuditRepository>;
  let recordAuditCount: RecordAuditCount;

  beforeEach(() => {
    auditRepository = {
      findById: jest.fn(),
      findByNumber: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<IInventoryAuditRepository>;

    recordAuditCount = new RecordAuditCount(auditRepository);
  });

  it("should successfully record a count on an in-progress audit", async () => {
    const auditId = "audit-123";
    const variantId = "variant-1";
    const countedQuantity = 15;
    const auditItem = new InventoryAuditItem("item-1", variantId, 10, null, false);
    const audit = new InventoryAudit(
      auditId,
      "AUD-123",
      "tenant-1",
      "loc-1",
      AuditStatus.InProgress,
      [auditItem]
    );

    auditRepository.findById.mockResolvedValue(audit);

    await recordAuditCount.execute({
      auditId,
      variantId,
      countedQuantity,
    });

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(auditItem.isCounted).toBe(true);
    expect(auditItem.countedQuantity).toBe(countedQuantity);
    expect(auditRepository.save).toHaveBeenCalledWith(audit);
  });

  it("should throw an error if the inventory audit is not found", async () => {
    const auditId = "audit-404";
    auditRepository.findById.mockResolvedValue(null);

    await expect(
      recordAuditCount.execute({
        auditId,
        variantId: "variant-1",
        countedQuantity: 10,
      })
    ).rejects.toThrow(`Inventory audit with ID ${auditId} not found.`);

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(auditRepository.save).not.toHaveBeenCalled();
  });

  it("should throw an error if the audit is not in-progress", async () => {
    const auditId = "audit-draft";
    const variantId = "variant-1";
    const auditItem = new InventoryAuditItem("item-1", variantId, 10, null, false);
    const audit = new InventoryAudit(
      auditId,
      "AUD-DRAFT",
      "tenant-1",
      "loc-1",
      AuditStatus.Draft,
      [auditItem]
    );

    auditRepository.findById.mockResolvedValue(audit);

    await expect(
      recordAuditCount.execute({
        auditId,
        variantId,
        countedQuantity: 10,
      })
    ).rejects.toThrow("Can only record counts on in-progress audits.");

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(auditRepository.save).not.toHaveBeenCalled();
  });

  it("should throw an error if the item variant is not found in the audit", async () => {
    const auditId = "audit-123";
    const variantId = "variant-1";
    const wrongVariantId = "variant-2";
    const auditItem = new InventoryAuditItem("item-1", variantId, 10, null, false);
    const audit = new InventoryAudit(
      auditId,
      "AUD-123",
      "tenant-1",
      "loc-1",
      AuditStatus.InProgress,
      [auditItem]
    );

    auditRepository.findById.mockResolvedValue(audit);

    await expect(
      recordAuditCount.execute({
        auditId,
        variantId: wrongVariantId,
        countedQuantity: 10,
      })
    ).rejects.toThrow(`Item with variant ID ${wrongVariantId} not found in this audit.`);

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(auditRepository.save).not.toHaveBeenCalled();
  });

  it("should throw an error if the counted quantity is negative", async () => {
    const auditId = "audit-123";
    const variantId = "variant-1";
    const countedQuantity = -5;
    const auditItem = new InventoryAuditItem("item-1", variantId, 10, null, false);
    const audit = new InventoryAudit(
      auditId,
      "AUD-123",
      "tenant-1",
      "loc-1",
      AuditStatus.InProgress,
      [auditItem]
    );

    auditRepository.findById.mockResolvedValue(audit);

    await expect(
      recordAuditCount.execute({
        auditId,
        variantId,
        countedQuantity,
      })
    ).rejects.toThrow("Counted quantity cannot be negative.");

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(auditRepository.save).not.toHaveBeenCalled();
  });

  it("should propagate errors thrown by auditRepository.findById", async () => {
    const auditId = "audit-123";
    const dbError = new Error("Database connection failed");
    auditRepository.findById.mockRejectedValue(dbError);

    await expect(
      recordAuditCount.execute({
        auditId,
        variantId: "variant-1",
        countedQuantity: 10,
      })
    ).rejects.toThrow("Database connection failed");

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(auditRepository.save).not.toHaveBeenCalled();
  });

  it("should propagate errors thrown by auditRepository.save", async () => {
    const auditId = "audit-123";
    const variantId = "variant-1";
    const auditItem = new InventoryAuditItem("item-1", variantId, 10, null, false);
    const audit = new InventoryAudit(
      auditId,
      "AUD-123",
      "tenant-1",
      "loc-1",
      AuditStatus.InProgress,
      [auditItem]
    );

    auditRepository.findById.mockResolvedValue(audit);
    const dbError = new Error("Database write failed");
    auditRepository.save.mockRejectedValue(dbError);

    await expect(
      recordAuditCount.execute({
        auditId,
        variantId,
        countedQuantity: 10,
      })
    ).rejects.toThrow("Database write failed");

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(auditRepository.save).toHaveBeenCalledWith(audit);
  });
});
