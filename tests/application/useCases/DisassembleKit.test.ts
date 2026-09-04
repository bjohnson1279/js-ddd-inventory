import { DisassembleKit } from "../../../src/application/useCases/DisassembleKit";
import { prisma } from "../../../src/infrastructure/database/prisma";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";

// Mock dependencies
jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    kitModel: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../../src/infrastructure/http/controllers/KitController", () => ({
  getInMemoryKit: jest.fn(),
}), { virtual: true });

describe("DisassembleKit Use Case", () => {
  let disassembleKit: DisassembleKit;
  let mockInventoryRepo: any;
  let mockCostLayerRepo: any;
  let mockTenantConfigRepo: any;
  let mockJournalRepo: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockInventoryRepo = {
      findBySku: jest.fn(),
      findBySkus: jest.fn(),
      save: jest.fn(),
      saveMany: jest.fn(),
    };

    mockCostLayerRepo = {
      getActiveLayers: jest.fn(),
      getActiveLayersByVariantIds: jest.fn(),
      save: jest.fn(),
      saveMany: jest.fn(),
    };

    mockTenantConfigRepo = {
      findByTenantId: jest.fn(),
    };

    mockJournalRepo = {
      save: jest.fn(),
    };

    disassembleKit = new DisassembleKit(
      mockInventoryRepo,
      mockCostLayerRepo,
      mockTenantConfigRepo,
      mockJournalRepo
    );

    // Default mock for cost layer service consumeFifoLayers
    (disassembleKit as any).costLayerService.consumeFifoLayers = jest.fn().mockResolvedValue({ totalCostCents: 1000 });
  });

  it("should handle error when prisma.kitModel.findUnique fails and kit is not in memory", async () => {
    // Arrange
    (prisma.kitModel.findUnique as jest.Mock).mockRejectedValue(Object.assign(new Error(), { code: 'ECONNREFUSED' }));

    const { getInMemoryKit } = require("../../../src/infrastructure/http/controllers/KitController");
    (getInMemoryKit as jest.Mock).mockReturnValue(null);

    const dto = {
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "KIT-123",
      quantity: 1,
      actorId: "actor-1",
      referenceId: "ref-1",
    };

    // Act & Assert
    await expect(disassembleKit.execute(dto)).rejects.toThrow("Kit with SKU KIT-123 not found.");

    expect(prisma.kitModel.findUnique).toHaveBeenCalledWith({
      where: { sku: "KIT-123" },
      include: { components: true },
    });
    expect(getInMemoryKit).toHaveBeenCalledWith("KIT-123");
  });

  it("should handle error when prisma.kitModel.findUnique fails but kit is found in memory fallback", async () => {
    // Arrange
    (prisma.kitModel.findUnique as jest.Mock).mockRejectedValue(Object.assign(new Error(), { code: 'ECONNREFUSED' }));

    const { getInMemoryKit } = require("../../../src/infrastructure/http/controllers/KitController");
    (getInMemoryKit as jest.Mock).mockReturnValue({
      sku: "KIT-123",
      components: [
        { variantId: "COMP-1", quantity: 2 }
      ]
    });

    const mockInvItem = {
        quantity: { getValue: () => 5 },
        dispatchStock: jest.fn(),
        sku: { getValue: () => "KIT-123" }
    };
    mockInventoryRepo.findBySku.mockResolvedValue(mockInvItem);
    mockInventoryRepo.findBySkus.mockResolvedValue([]);
    mockCostLayerRepo.getActiveLayersByVariantIds.mockResolvedValue(new Map());

    const dto = {
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "KIT-123",
      quantity: 1,
      actorId: "actor-1",
      referenceId: "ref-1",
    };

    // Act
    await disassembleKit.execute(dto);

    // Assert
    expect(prisma.kitModel.findUnique).toHaveBeenCalled();
    expect(getInMemoryKit).toHaveBeenCalledWith("KIT-123");
    expect(mockInventoryRepo.findBySku).toHaveBeenCalled();
    expect(mockInvItem.dispatchStock).toHaveBeenCalled();
  });

  it("should handle error when prisma.kitModel.findUnique throws an explicit error and verify that the fallback logic handles it without crashing", async () => {
    // Arrange
    (prisma.kitModel.findUnique as jest.Mock).mockRejectedValue(Object.assign(new Error("Explicit retrieval failure"), { name: 'PrismaClientKnownRequestError' }));

    const { getInMemoryKit } = require("../../../src/infrastructure/http/controllers/KitController");
    (getInMemoryKit as jest.Mock).mockReturnValue({
      sku: "KIT-999",
      components: [
        { variantId: "COMP-2", quantity: 1 }
      ]
    });

    const mockInvItem = {
        quantity: { getValue: () => 5 },
        dispatchStock: jest.fn(),
        sku: { getValue: () => "KIT-999" }
    };
    mockInventoryRepo.findBySku.mockResolvedValue(mockInvItem);
    mockInventoryRepo.findBySkus.mockResolvedValue([]);
    mockCostLayerRepo.getActiveLayersByVariantIds.mockResolvedValue(new Map());

    const dto = {
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "KIT-999",
      quantity: 1,
      actorId: "actor-1",
      referenceId: "ref-1",
    };

    // Act
    await disassembleKit.execute(dto);

    // Assert
    expect(prisma.kitModel.findUnique).toHaveBeenCalledWith({
      where: { sku: "KIT-999" },
      include: { components: true },
    });
    expect(getInMemoryKit).toHaveBeenCalledWith("KIT-999");
    expect(mockInventoryRepo.findBySku).toHaveBeenCalled();
    expect(mockInvItem.dispatchStock).toHaveBeenCalled();
  });
});
