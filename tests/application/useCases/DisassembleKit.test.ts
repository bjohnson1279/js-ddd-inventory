import { DisassembleKit, DisassembleKitDTO } from "../../../src/application/useCases/DisassembleKit";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../../src/domain/repositories/ICostLayerRepository";
import { ITenantConfigRepository } from "../../../src/domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../../src/domain/repositories/IJournalRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InventoryCostLayer } from "../../../src/domain/accounting/entities/InventoryCostLayer";
import { prisma } from "../../../src/infrastructure/database/prisma";
import * as KitController from "../../../src/infrastructure/http/controllers/KitController";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";

jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    kitModel: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../../src/infrastructure/http/controllers/KitController", () => ({
  getInMemoryKit: jest.fn(),
}));

describe("DisassembleKit Use Case", () => {
  let inventoryRepo: jest.Mocked<IInventoryRepository>;
  let costLayerRepo: jest.Mocked<ICostLayerRepository>;
  let tenantConfigRepo: jest.Mocked<ITenantConfigRepository>;
  let journalRepo: jest.Mocked<IJournalRepository>;
  let useCase: DisassembleKit;

  beforeEach(() => {
    inventoryRepo = {
      findBySku: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      findAllByLocation: jest.fn(),
      hasAnyEntries: jest.fn(),
      hasConflicts: jest.fn(),
      saveMany: jest.fn(),
      findBySkus: jest.fn(),
    } as any;

    costLayerRepo = {
      save: jest.fn(),
      saveMany: jest.fn(),
      getActiveLayers: jest.fn(),
      getActiveLayersByVariantIds: jest.fn(),
      getUnprocessedLayers: jest.fn(),
      markLayerAsProcessed: jest.fn(),
    } as any;

    tenantConfigRepo = {
      findByTenantId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;

    journalRepo = {
      save: jest.fn(),
      findByTenantId: jest.fn(),
    } as any;

    useCase = new DisassembleKit(inventoryRepo, costLayerRepo, tenantConfigRepo, journalRepo);
    jest.clearAllMocks();
  });

  const dto: DisassembleKitDTO = {
    tenantId: "tenant-1",
    locationId: "loc-1",
    kitSku: "KIT-1",
    quantity: 1,
    actorId: "actor-1",
    referenceId: "ref-1",
  };

  it("should throw an error if quantity is less than or equal to zero", async () => {
    await expect(useCase.execute({ ...dto, quantity: 0 })).rejects.toThrow("Quantity to disassemble must be greater than zero.");
  });

  it("should throw an error if kit is not found", async () => {
    (prisma.kitModel.findUnique as jest.Mock).mockResolvedValue(null);
    (KitController.getInMemoryKit as jest.Mock).mockReturnValue(null);

    await expect(useCase.execute(dto)).rejects.toThrow("Kit with SKU KIT-1 not found.");
  });

  it("should throw an error if available kit stock is insufficient", async () => {
    const kitRecord = {
      sku: "KIT-1",
      components: [{ variantId: "COMP-1", quantity: 2 }],
    };
    (prisma.kitModel.findUnique as jest.Mock).mockResolvedValue(kitRecord);

    // Setup kit item with only 0 quantity
    const kitSkuObj = SKU.create("KIT-1");
    const kitInvItem = InventoryItem.create("item-1", kitSkuObj, "loc-1", Quantity.create(0));
    inventoryRepo.findBySku.mockResolvedValueOnce(kitInvItem);

    await expect(useCase.execute(dto)).rejects.toThrow("Insufficient stock for Kit variant KIT-1. Needed: 1, Available: 0");
  });

  it("should disassemble kit successfully (happy path) with mock database components", async () => {
    const kitRecord = {
      sku: "KIT-1",
      components: [{ variantId: "COMP-1", quantity: 2 }],
    };
    (prisma.kitModel.findUnique as jest.Mock).mockResolvedValue(kitRecord);

    const kitSkuObj = SKU.create("KIT-1");
    const kitInvItem = InventoryItem.create("item-1", kitSkuObj, "loc-1", Quantity.create(5));

    // First call is for kit itself
    inventoryRepo.findBySku.mockResolvedValueOnce(kitInvItem);

    // Second part is fetching components in findBySkus
    (inventoryRepo.findBySkus as jest.Mock).mockResolvedValueOnce([]);

    costLayerRepo.getActiveLayers.mockResolvedValue([
      new InventoryCostLayer("layer-1", "KIT-1", "tenant-1", 5, 1000, new Date(), "ref-1", "loc-1")
    ]);

    (costLayerRepo.getActiveLayersByVariantIds as jest.Mock).mockResolvedValue(new Map([
      ["COMP-1", [new InventoryCostLayer("layer-2", "COMP-1", "tenant-1", 10, 500, new Date(), "ref-1", "loc-1")]]
    ]));

    tenantConfigRepo.findByTenantId.mockResolvedValue({
      id: "conf-1",
      tenantId: "tenant-1",
      accountingMethod: AccountingMethod.Accrual,
    } as any);

    await useCase.execute(dto);

    expect(inventoryRepo.save).toHaveBeenCalledWith(kitInvItem);
    // Should have saved new component inventory via saveMany
    expect((inventoryRepo as any).saveMany).toHaveBeenCalled();
    expect((costLayerRepo as any).saveMany).toHaveBeenCalled();
    expect(journalRepo.save).toHaveBeenCalled();
  });

  it("should handle fallback when prisma throws an error but in-memory kit is found", async () => {
    (prisma.kitModel.findUnique as jest.Mock).mockRejectedValue(new Error("DB Connection error"));

    const kitRecord = {
      sku: "KIT-1",
      components: [{ variantId: "COMP-1", quantity: 2 }],
    };
    (KitController.getInMemoryKit as jest.Mock).mockReturnValue(kitRecord);

    const kitSkuObj = SKU.create("KIT-1");
    const kitInvItem = InventoryItem.create("item-1", kitSkuObj, "loc-1", Quantity.create(5));
    inventoryRepo.findBySku.mockResolvedValueOnce(kitInvItem);

    (inventoryRepo.findBySkus as jest.Mock).mockResolvedValueOnce([]);

    costLayerRepo.getActiveLayers.mockResolvedValue([
      new InventoryCostLayer("layer-1", "KIT-1", "tenant-1", 5, 1000, new Date(), "ref-1", "loc-1")
    ]);

    (costLayerRepo.getActiveLayersByVariantIds as jest.Mock).mockResolvedValue(new Map([
      ["COMP-1", [new InventoryCostLayer("layer-2", "COMP-1", "tenant-1", 10, 500, new Date(), "ref-1", "loc-1")]]
    ]));

    await useCase.execute(dto);

    expect(inventoryRepo.save).toHaveBeenCalledWith(kitInvItem);
    expect(KitController.getInMemoryKit).toHaveBeenCalledWith("KIT-1");
  });
});
