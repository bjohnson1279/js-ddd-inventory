import { StartInventoryAudit } from "../../../src/application/useCases/StartInventoryAudit";
import { IInventoryAuditRepository } from "../../../src/domain/repositories/IInventoryAuditRepository";

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

  it("should successfully start an inventory audit", async () => {
    const auditId = "audit-123";
    const mockAudit = {
      start: jest.fn(),
    };

    auditRepository.findById.mockResolvedValue(mockAudit as any);

    await startInventoryAudit.execute(auditId);

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(mockAudit.start).toHaveBeenCalled();
    expect(auditRepository.save).toHaveBeenCalledWith(mockAudit);
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
    const mockAudit = {
      start: jest.fn(),
    };

    auditRepository.findById.mockResolvedValue(mockAudit as any);
    const dbError = new Error("Database write failed");
    auditRepository.save.mockRejectedValue(dbError);

    await expect(startInventoryAudit.execute(auditId)).rejects.toThrow(
      "Database write failed"
    );

    expect(auditRepository.findById).toHaveBeenCalledWith(auditId);
    expect(mockAudit.start).toHaveBeenCalled();
    expect(auditRepository.save).toHaveBeenCalledWith(mockAudit);
  });
});
