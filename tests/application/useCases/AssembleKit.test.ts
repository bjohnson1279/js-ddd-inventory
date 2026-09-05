import { AssembleKit } from "../../../src/application/useCases/AssembleKit";
import { prisma } from "../../../src/infrastructure/database/prisma";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";
import { InventoryCostLayer } from "../../../src/domain/accounting/entities/InventoryCostLayer";
import crypto from "crypto";

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

describe("AssembleKit Use Case", () => {
  let assembleKit: AssembleKit;
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
      save: jest.fn(),
    };

    mockTenantConfigRepo = {
      findByTenantId: jest.fn(),
    };

    mockJournalRepo = {
      save: jest.fn(),
    };

    assembleKit = new AssembleKit(
      mockInventoryRepo,
      mockCostLayerRepo,
      mockTenantConfigRepo,
      mockJournalRepo
    );

    // Default mock for cost layer service consumeFifoLayersBatch
    (assembleKit as any).costLayerService.consumeFifoLayersBatch = jest.fn().mockResolvedValue([{ totalCostCents: 1000 }]);
    (assembleKit as any).journalService.onKitAssembly = jest.fn().mockResolvedValue(undefined);
  });

  it("should throw an error if quantity to assemble is less than or equal to zero", async () => {
    const dto = {
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "KIT-123",
      quantity: 0,
      actorId: "actor-1",
      referenceId: "ref-1",
    };

    await expect(assembleKit.execute(dto)).rejects.toThrow("Quantity to assemble must be greater than zero.");
  });

  it("should throw an error if kit is not found in prisma or memory", async () => {
    (prisma.kitModel.findUnique as jest.Mock).mockResolvedValue(null);

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

    await expect(assembleKit.execute(dto)).rejects.toThrow("Kit with SKU KIT-123 not found.");
  });

  it("should assemble kit successfully when kit is found via prisma", async () => {
    (prisma.kitModel.findUnique as jest.Mock).mockResolvedValue({
      sku: "KIT-123",
      components: [
        { variantId: "COMP-1", quantity: 2 }
      ]
    });

    const mockCompItem = {
      sku: { getValue: () => "COMP-1" },
      quantity: { getValue: () => 10 },
      dispatchStock: jest.fn(),
    };

    mockInventoryRepo.findBySkus.mockResolvedValue([mockCompItem]);

    const mockKitItem = {
      sku: { getValue: () => "KIT-123" },
      quantity: { getValue: () => 0 },
      receiveStock: jest.fn(),
    };
    mockInventoryRepo.findBySku.mockResolvedValue(mockKitItem);
    mockTenantConfigRepo.findByTenantId.mockResolvedValue({ accountingMethod: AccountingMethod.Accrual });

    const dto = {
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "KIT-123",
      quantity: 1,
      actorId: "actor-1",
      referenceId: "ref-1",
    };

    await assembleKit.execute(dto);

    expect(prisma.kitModel.findUnique).toHaveBeenCalledWith({
      where: { sku: "KIT-123" },
      include: { components: true }
    });
    expect(mockCompItem.dispatchStock).toHaveBeenCalledWith(expect.any(Quantity));
    expect(mockInventoryRepo.saveMany).toHaveBeenCalled();
    expect(mockCostLayerRepo.save).toHaveBeenCalled();
    expect(mockKitItem.receiveStock).toHaveBeenCalledWith(expect.any(Quantity));
    expect((assembleKit as any).journalService.onKitAssembly).toHaveBeenCalled();
  });

  it("should assemble kit successfully when kit is found via in-memory fallback", async () => {
    (prisma.kitModel.findUnique as jest.Mock).mockRejectedValue(Object.assign(new Error("Database offline"), { code: 'P1001' }));

    const { getInMemoryKit } = require("../../../src/infrastructure/http/controllers/KitController");
    (getInMemoryKit as jest.Mock).mockReturnValue({
      sku: "KIT-123",
      components: [
        { variantId: "COMP-1", quantity: 2 }
      ]
    });

    const mockCompItem = {
      sku: { getValue: () => "COMP-1" },
      quantity: { getValue: () => 10 },
      dispatchStock: jest.fn(),
    };

    mockInventoryRepo.findBySkus.mockResolvedValue([mockCompItem]);

    const mockKitItem = {
      sku: { getValue: () => "KIT-123" },
      quantity: { getValue: () => 0 },
      receiveStock: jest.fn(),
    };
    mockInventoryRepo.findBySku.mockResolvedValue(mockKitItem);
    mockTenantConfigRepo.findByTenantId.mockResolvedValue({ accountingMethod: AccountingMethod.Cash });

    const dto = {
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "KIT-123",
      quantity: 1,
      actorId: "actor-1",
      referenceId: "ref-1",
    };

    await assembleKit.execute(dto);

    expect(prisma.kitModel.findUnique).toHaveBeenCalledWith({
      where: { sku: "KIT-123" },
      include: { components: true }
    });
    expect(getInMemoryKit).toHaveBeenCalledWith("KIT-123");
    expect(mockCompItem.dispatchStock).toHaveBeenCalledWith(expect.any(Quantity));
    expect(mockInventoryRepo.saveMany).toHaveBeenCalled();
    expect(mockCostLayerRepo.save).toHaveBeenCalled();
    expect(mockKitItem.receiveStock).toHaveBeenCalledWith(expect.any(Quantity));
    expect((assembleKit as any).journalService.onKitAssembly).not.toHaveBeenCalled(); // Cash accounting doesn't accrue
  });

  it("should throw an error if there is insufficient stock for a component", async () => {
    (prisma.kitModel.findUnique as jest.Mock).mockRejectedValue(Object.assign(new Error(), { code: 'ECONNREFUSED' }));

    const { getInMemoryKit } = require("../../../src/infrastructure/http/controllers/KitController");
    (getInMemoryKit as jest.Mock).mockReturnValue({
      sku: "KIT-123",
      components: [
        { variantId: "COMP-1", quantity: 2 }
      ]
    });

    const mockCompItem = {
      sku: { getValue: () => "COMP-1" },
      quantity: { getValue: () => 1 }, // Insufficient: needs 2
      dispatchStock: jest.fn(),
    };

    mockInventoryRepo.findBySkus.mockResolvedValue([mockCompItem]);

    const dto = {
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "KIT-123",
      quantity: 1,
      actorId: "actor-1",
      referenceId: "ref-1",
    };

    await expect(assembleKit.execute(dto)).rejects.toThrow("Insufficient stock for component variant ID COMP-1");
  });

  it("should handle inventory repo without saveMany", async () => {
    (prisma.kitModel.findUnique as jest.Mock).mockResolvedValue({
      sku: "KIT-123",
      components: [
        { variantId: "COMP-1", quantity: 2 }
      ]
    });

    const mockCompItem = {
      sku: { getValue: () => "COMP-1" },
      quantity: { getValue: () => 10 },
      dispatchStock: jest.fn(),
    };

    mockInventoryRepo.findBySkus.mockResolvedValue([mockCompItem]);
    delete mockInventoryRepo.saveMany; // Remove saveMany to test fallback

    const mockKitItem = {
      sku: { getValue: () => "KIT-123" },
      quantity: { getValue: () => 0 },
      receiveStock: jest.fn(),
    };
    mockInventoryRepo.findBySku.mockResolvedValue(mockKitItem);
    mockTenantConfigRepo.findByTenantId.mockResolvedValue({ accountingMethod: AccountingMethod.Cash });

    const dto = {
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "KIT-123",
      quantity: 1,
      actorId: "actor-1",
      referenceId: "ref-1",
    };

    await assembleKit.execute(dto);

    expect(mockInventoryRepo.save).toHaveBeenCalled();
  });
});
