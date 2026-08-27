import { DisassembleKit, DisassembleKitDTO } from "../../../src/application/useCases/DisassembleKit";
import { prisma } from "../../../src/infrastructure/database/prisma";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../../src/domain/repositories/ICostLayerRepository";
import { ITenantConfigRepository } from "../../../src/domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../../src/domain/repositories/IJournalRepository";

jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    kitModel: {
      findUnique: jest.fn(),
    },
  },
}));

describe("DisassembleKit Use Case", () => {
  let useCase: DisassembleKit;
  let mockInventoryRepo: jest.Mocked<IInventoryRepository>;
  let mockCostLayerRepo: jest.Mocked<ICostLayerRepository>;
  let mockTenantConfigRepo: jest.Mocked<ITenantConfigRepository>;
  let mockJournalRepo: jest.Mocked<IJournalRepository>;

  beforeEach(() => {
    mockInventoryRepo = {
      findBySku: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      findAllByLocation: jest.fn(),
      hasAnyEntries: jest.fn(),
      hasConflicts: jest.fn(),
    } as any;

    mockCostLayerRepo = {
      getActiveLayers: jest.fn(),
      getActiveLayersByVariantIds: jest.fn(),
      save: jest.fn(),
      saveMany: jest.fn(),
    } as any;

    mockTenantConfigRepo = {
      findByTenantId: jest.fn(),
      save: jest.fn(),
    } as any;

    mockJournalRepo = {
      save: jest.fn(),
      findByTenantAndDateRange: jest.fn(),
    } as any;

    useCase = new DisassembleKit(
      mockInventoryRepo,
      mockCostLayerRepo,
      mockTenantConfigRepo,
      mockJournalRepo
    );

    jest.clearAllMocks();
  });

  it("should handle prisma.kitModel.findUnique error without crashing and fallback to throwing not found if fallback also fails", async () => {
    // Mock prisma to throw an error
    (prisma.kitModel.findUnique as jest.Mock).mockRejectedValue(new Error("Database connection lost"));

    const dto: DisassembleKitDTO = {
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "KIT-XYZ",
      quantity: 1,
      actorId: "actor-1",
      referenceId: "ref-1",
    };

    // Should not crash with unhandled rejection, but throw the expected "not found" error because the in-memory fallback will return null by default in tests.
    await expect(useCase.execute(dto)).rejects.toThrow("Kit with SKU KIT-XYZ not found.");

    // Verify that Prisma was indeed called
    expect(prisma.kitModel.findUnique).toHaveBeenCalledWith({
      where: { sku: "KIT-XYZ" },
      include: { components: true },
    });
  });
});
