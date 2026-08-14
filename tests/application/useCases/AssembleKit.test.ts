import { AssembleKit } from "../../../src/application/useCases/AssembleKit";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../../src/domain/repositories/ICostLayerRepository";
import { ITenantConfigRepository } from "../../../src/domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../../src/domain/repositories/IJournalRepository";
import { prisma } from "../../../src/infrastructure/database/prisma";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";

jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    kitModel: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../../src/infrastructure/http/controllers/KitController", () => ({
  getInMemoryKit: jest.fn().mockReturnValue(null),
}));

describe("AssembleKit Use Case", () => {
  let mockInventoryRepo: jest.Mocked<IInventoryRepository>;
  let mockCostLayerRepo: jest.Mocked<ICostLayerRepository>;
  let mockTenantConfigRepo: jest.Mocked<ITenantConfigRepository>;
  let mockJournalRepo: jest.Mocked<IJournalRepository>;
  let useCase: AssembleKit;

  beforeEach(() => {
    mockInventoryRepo = {
      findBySku: jest.fn(),
      save: jest.fn(),
      findBySkus: jest.fn(),
      saveMany: jest.fn(),
    } as any;

    mockCostLayerRepo = {
      save: jest.fn(),
      getActiveLayers: jest.fn().mockResolvedValue([]),
    } as any;

    mockTenantConfigRepo = {
      findByTenantId: jest.fn(),
    } as any;

    mockJournalRepo = {
      save: jest.fn(),
    } as any;

    useCase = new AssembleKit(
      mockInventoryRepo,
      mockCostLayerRepo,
      mockTenantConfigRepo,
      mockJournalRepo
    );

    jest.clearAllMocks();
  });

  it("should throw an error if quantity to assemble is zero or negative", async () => {
    const dto = {
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "KIT-SKU",
      quantity: 0,
      actorId: "actor-1",
      referenceId: "ref-1",
    };

    await expect(useCase.execute(dto)).rejects.toThrow("Quantity to assemble must be greater than zero.");

    dto.quantity = -5;
    await expect(useCase.execute(dto)).rejects.toThrow("Quantity to assemble must be greater than zero.");
  });

  it("should throw an error if the kit is not found", async () => {
    const dto = {
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "NON-EXISTENT-KIT",
      quantity: 1,
      actorId: "actor-1",
      referenceId: "ref-1",
    };

    (prisma.kitModel.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(useCase.execute(dto)).rejects.toThrow("Kit with SKU NON-EXISTENT-KIT not found.");
  });


  it("should throw an error if stock for component is insufficient", async () => {
    const dto = {
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "EXISTING-KIT",
      quantity: 2,
      actorId: "actor-1",
      referenceId: "ref-1",
    };

    const mockKit = {
      sku: "EXISTING-KIT",
      components: [
        { variantId: "COMP-1", quantity: 3 }
      ]
    };

    (prisma.kitModel.findUnique as jest.Mock).mockResolvedValue(mockKit);

    // Mock findBySku to return an item with insufficient quantity
    const mockInventoryItem = {
      sku: { getValue: () => "COMP-1" },
      quantity: { getValue: () => 5 } // Needed: 3 * 2 = 6, Available: 5
    };

    mockInventoryRepo.findBySkus = jest.fn().mockResolvedValue([mockInventoryItem]);

    await expect(useCase.execute(dto)).rejects.toThrow("Insufficient stock for component variant ID COMP-1. Needed: 6, Available: 5");
  });


  it("should successfully assemble a kit", async () => {
    const dto = {
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "EXISTING-KIT",
      quantity: 2,
      actorId: "actor-1",
      referenceId: "ref-1",
    };

    const mockKit = {
      sku: "EXISTING-KIT",
      components: [
        { variantId: "COMP-1", quantity: 3 }
      ]
    };

    (prisma.kitModel.findUnique as jest.Mock).mockResolvedValue(mockKit);

    const mockInventoryItem = {
      sku: { getValue: () => "COMP-1" },
      quantity: { getValue: () => 10 }, // Needed: 6, Available: 10
      dispatchStock: jest.fn(),
    };

    const mockKitItem = {
      sku: { getValue: () => "EXISTING-KIT" },
      quantity: { getValue: () => 0 },
      receiveStock: jest.fn(),
    };

    mockInventoryRepo.findBySkus = jest.fn().mockResolvedValue([mockInventoryItem]);
    mockInventoryRepo.findBySku = jest.fn().mockResolvedValue(mockKitItem);

    // Mock the cost layer repository to avoid errors
    const mockActiveLayer = {
      variantId: "COMP-1",
      remainingQuantity: 10,
      unitCostCents: 100,
      consume: jest.fn().mockReturnValue(6)
    };
    mockCostLayerRepo.getActiveLayers = jest.fn().mockResolvedValue([mockActiveLayer]);
    mockCostLayerRepo.save = jest.fn();

    // Mock tenant config
    mockTenantConfigRepo.findByTenantId = jest.fn().mockResolvedValue({
        accountingMethod: AccountingMethod.Accrual
    });

    await useCase.execute(dto);

    expect(mockInventoryItem.dispatchStock).toHaveBeenCalled();
    expect(mockKitItem.receiveStock).toHaveBeenCalled();
    expect(mockInventoryRepo.saveMany).toHaveBeenCalled();
    expect(mockCostLayerRepo.save).toHaveBeenCalled();
  });
});
