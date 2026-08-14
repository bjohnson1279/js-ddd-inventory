import { AssembleKit } from "../../../src/application/useCases/AssembleKit";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../../src/domain/repositories/ICostLayerRepository";
import { ITenantConfigRepository } from "../../../src/domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../../src/domain/repositories/IJournalRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { InventoryCostLayer } from "../../../src/domain/accounting/entities/InventoryCostLayer";
import { prisma } from "../../../src/infrastructure/database/prisma";
import { TenantAccountingConfig } from "../../../src/domain/accounting/valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";
import { CostingMethod } from "../../../src/domain/accounting/enums/CostingMethod";
import { DebitCredit } from "../../../src/domain/accounting/enums/DebitCredit";


jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    kitModel: {
      findUnique: jest.fn()
    }
  }
}));

// We need to mock node:crypto for JournalEntry and other domain uses
jest.mock("crypto", () => ({
  randomUUID: jest.fn().mockReturnValue("mock-uuid")
}));

describe("AssembleKit", () => {
  let inventoryRepo: jest.Mocked<IInventoryRepository>;
  let costLayerRepo: jest.Mocked<ICostLayerRepository>;
  let tenantConfigRepo: jest.Mocked<ITenantConfigRepository>;
  let journalRepo: jest.Mocked<IJournalRepository>;
  let assembleKit: AssembleKit;

  beforeEach(() => {
    inventoryRepo = {
      findBySku: jest.fn(),
      findBySkus: jest.fn() as any, // Cast to any to allow mock functions
      save: jest.fn(),
      saveMany: jest.fn() as any,
    } as any;
    costLayerRepo = {
      save: jest.fn(),
      saveMany: jest.fn() as any,
      getActiveLayers: jest.fn(),
      getActiveLayersByVariantIds: jest.fn() as any,
    } as any;
    tenantConfigRepo = {
      findByTenantId: jest.fn(),
      save: jest.fn(),
    };
    journalRepo = {
      save: jest.fn(),
      findAll: jest.fn(),
    };

    assembleKit = new AssembleKit(
      inventoryRepo,
      costLayerRepo,
      tenantConfigRepo,
      journalRepo

    );

    jest.clearAllMocks();
  });

  it("should throw error if quantity is <= 0", async () => {
    await expect(assembleKit.execute({
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "KIT-1",
      quantity: 0,
      actorId: "actor-1",
      referenceId: "ref-1"
    })).rejects.toThrow("Quantity to assemble must be greater than zero.");
  });

  it("should throw error if kit is not found", async () => {
    (prisma.kitModel.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(assembleKit.execute({
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "KIT-1",
      quantity: 1,
      actorId: "actor-1",
      referenceId: "ref-1"
    })).rejects.toThrow("Kit with SKU KIT-1 not found.");
  });

  it("should throw error if insufficient stock for a component", async () => {
    (prisma.kitModel.findUnique as jest.Mock).mockResolvedValue({
      sku: "KIT-1",
      components: [
        { variantId: "COMP-1", quantity: 2 },
      ]
    });

    const comp1 = InventoryItem.create("item-1", SKU.create("COMP-1"), "loc-1", Quantity.create(1)); // Only 1 available, needs 2
    (inventoryRepo.findBySkus as jest.Mock).mockResolvedValue([comp1]);

    await expect(assembleKit.execute({
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "KIT-1",
      quantity: 1,
      actorId: "actor-1",
      referenceId: "ref-1"
    })).rejects.toThrow("Insufficient stock for component variant ID COMP-1. Needed: 2, Available: 1");
  });

  it("should assemble a kit successfully", async () => {
    // Mock Kit
    (prisma.kitModel.findUnique as jest.Mock).mockResolvedValue({
      sku: "KIT-1",
      components: [
        { variantId: "COMP-1", quantity: 2 },
        { variantId: "COMP-2", quantity: 1 }
      ]
    });

    // Mock InventoryItems
    const comp1 = InventoryItem.create("item-1", SKU.create("COMP-1"), "loc-1", Quantity.create(10));
    const comp2 = InventoryItem.create("item-2", SKU.create("COMP-2"), "loc-1", Quantity.create(5));
    (inventoryRepo.findBySkus as jest.Mock).mockResolvedValue([comp1, comp2]);
    inventoryRepo.findBySku.mockResolvedValue(null); // For the newly assembled kit

    // Mock Cost Layers
    const layer1 = new InventoryCostLayer("l1", "COMP-1", "tenant-1", 10, 100, new Date(), "po-1", "loc-1");
    const layer2 = new InventoryCostLayer("l2", "COMP-2", "tenant-1", 5, 200, new Date(), "po-2", "loc-1");

    (costLayerRepo.getActiveLayersByVariantIds as jest.Mock).mockResolvedValue(new Map([
      ["COMP-1", [layer1]],
      ["COMP-2", [layer2]]
    ]));
    (costLayerRepo.getActiveLayers as jest.Mock).mockResolvedValue([]); // Fallback

    // Mock Tenant Config
    tenantConfigRepo.findByTenantId.mockResolvedValue(
      new TenantAccountingConfig(AccountingMethod.Accrual, CostingMethod.FIFO, "USD", "01-01")
    );

    await assembleKit.execute({
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "KIT-1",
      quantity: 1,
      actorId: "actor-1",
      referenceId: "ref-1"
    });

    // Verify stock deductions for components
    expect(comp1.quantity.getValue()).toBe(8); // 10 - 2
    expect(comp2.quantity.getValue()).toBe(4); // 5 - 1

    // Verify stock creation for kit
    expect(inventoryRepo.save).toHaveBeenCalled();
    const savedKitItem = inventoryRepo.save.mock.calls.find(c => c[0].sku.getValue() === "KIT-1");
    expect(savedKitItem).toBeDefined();
    expect(savedKitItem![0].quantity.getValue()).toBe(1);

    // Verify kit cost layer creation
    expect(costLayerRepo.save).toHaveBeenCalled();
    const kitCostLayer = costLayerRepo.save.mock.calls[0][0];
    expect(kitCostLayer.variantId).toBe("KIT-1");
    expect(kitCostLayer.unitCostCents).toBe(400); // (2*100) + (1*200) = 400

    // Verify total cost calculation and journal entry
    expect(journalRepo.save).toHaveBeenCalled();
    const journalEntry = journalRepo.save.mock.calls[0][0];

    // Debit WIP / Finished Goods, Credit Raw Materials.
    let totalDebit = 0;
    for (const line of journalEntry.lines) {
      if (line.type === DebitCredit.Debit) {
        totalDebit += line.amountCents;
      }
    }
    expect(totalDebit).toBe(400);
  });

  it("should not create journal entry if accounting method is not Accrual", async () => {
    // Mock Kit
    (prisma.kitModel.findUnique as jest.Mock).mockResolvedValue({
      sku: "KIT-1",
      components: [
        { variantId: "COMP-1", quantity: 1 }
      ]
    });

    // Mock InventoryItems
    const comp1 = InventoryItem.create("item-1", SKU.create("COMP-1"), "loc-1", Quantity.create(10));
    (inventoryRepo.findBySkus as jest.Mock).mockResolvedValue([comp1]);
    inventoryRepo.findBySku.mockResolvedValue(null);

    // Mock Cost Layers
    const layer1 = new InventoryCostLayer("l1", "COMP-1", "tenant-1", 10, 100, new Date(), "po-1", "loc-1");
    (costLayerRepo.getActiveLayersByVariantIds as jest.Mock).mockResolvedValue(new Map([
      ["COMP-1", [layer1]]
    ]));

    // Mock Tenant Config
    tenantConfigRepo.findByTenantId.mockResolvedValue(
      new TenantAccountingConfig(AccountingMethod.Cash, CostingMethod.WeightedAverageCost, "USD", "01-01")
    );

    await assembleKit.execute({
      tenantId: "tenant-1",
      locationId: "loc-1",
      kitSku: "KIT-1",
      quantity: 1,
      actorId: "actor-1",
      referenceId: "ref-1"
    });

    // Journal should not be saved for cash accounting in this context
    expect(journalRepo.save).not.toHaveBeenCalled();

  });
});
