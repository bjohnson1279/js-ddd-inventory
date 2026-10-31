import { PrismaInventoryRepository } from "../../../src/infrastructure/database/PrismaInventoryRepository";
import { prisma as sharedPrisma, pool } from "../../../src/infrastructure/database/prisma";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { ConcurrencyException } from "../../../src/domain/exceptions/ConcurrencyException";
import { IOutboxRepository } from "../../../src/domain/repositories/IOutboxRepository";
import { WebSocketManager } from "../../../src/infrastructure/websocket/WebSocketManager";

describe("PrismaInventoryRepository Integration Tests", () => {
  let prisma = sharedPrisma;
  let repo: PrismaInventoryRepository;
  let mockOutboxRepo: jest.Mocked<IOutboxRepository>;
  let broadcastSpy: jest.SpyInstance;

  beforeAll(() => {
    repo = new PrismaInventoryRepository();
    mockOutboxRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      fetchPending: jest.fn().mockResolvedValue([]),
      markProcessed: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      fetchDeadLettered: jest.fn().mockResolvedValue([]),
      retryEvent: jest.fn().mockResolvedValue(undefined),
      fetchStats: jest.fn().mockResolvedValue({ totalPending: 0, totalProcessed: 0, totalDeadLettered: 0, recentFailures: [] }),
    };
    broadcastSpy = jest.spyOn(WebSocketManager, "broadcastToTenant").mockImplementation(() => {});
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    try {
      await prisma.inventoryModel.deleteMany();
      await prisma.complianceLedgerModel.deleteMany();
      await prisma.outboxEventModel.deleteMany();
    } catch {}
  });

  afterAll(async () => {
    broadcastSpy.mockRestore();
    try {
      await prisma.inventoryModel.deleteMany();
      await prisma.complianceLedgerModel.deleteMany();
      await prisma.outboxEventModel.deleteMany();
    } catch {}
    await prisma.$disconnect();
    await pool.end();
  });

  describe("Query Operations", () => {
    it("should return null when finding non-existent SKU", async () => {
      const result = await repo.findBySku(SKU.create("NON-EXISTENT"), "loc-1");
      expect(result).toBeNull();
    });

    it("should find an item by SKU and specific locationId", async () => {
      const item = InventoryItem.create(
        "inv-1",
        SKU.create("SKU-QUERY-1"),
        "loc-A",
        Quantity.create(15),
        Quantity.create(5),
        Quantity.create(2),
        1
      );
      await repo.save(item);

      const found = await repo.findBySku(SKU.create("SKU-QUERY-1"), "loc-A");
      expect(found).not.toBeNull();
      expect(found?.id).toBe("inv-1");
      expect(found?.sku.getValue()).toBe("SKU-QUERY-1");
      expect(found?.locationId).toBe("loc-A");
      expect(found?.quantity.getValue()).toBe(15);
      expect(found?.allocated.getValue()).toBe(5);
      expect(found?.inTransit.getValue()).toBe(2);
      expect(found?.version).toBe(1);
    });

    it("should find the first item by SKU when locationId is omitted", async () => {
      const item1 = InventoryItem.create(
        "inv-loc1",
        SKU.create("SKU-MULTI-LOC"),
        "loc-1",
        Quantity.create(10),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      const item2 = InventoryItem.create(
        "inv-loc2",
        SKU.create("SKU-MULTI-LOC"),
        "loc-2",
        Quantity.create(20),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      await repo.save(item1);
      await repo.save(item2);

      const found = await repo.findBySku(SKU.create("SKU-MULTI-LOC"));
      expect(found).not.toBeNull();
      expect(found?.sku.getValue()).toBe("SKU-MULTI-LOC");
    });

    it("should find all items across locations with findAllBySku", async () => {
      const item1 = InventoryItem.create(
        "inv-sku-1",
        SKU.create("SKU-ALL-LOC"),
        "loc-X",
        Quantity.create(7),
        Quantity.create(1),
        Quantity.create(0),
        1
      );
      const item2 = InventoryItem.create(
        "inv-sku-2",
        SKU.create("SKU-ALL-LOC"),
        "loc-Y",
        Quantity.create(14),
        Quantity.create(2),
        Quantity.create(0),
        1
      );
      await repo.save(item1);
      await repo.save(item2);

      const founds = await repo.findAllBySku(SKU.create("SKU-ALL-LOC"));
      expect(founds.length).toBe(2);
      expect(founds.map(f => f.locationId).sort()).toEqual(["loc-X", "loc-Y"]);
    });

    it("should find items by multiple SKUs with default and explicit locationId", async () => {
      const itemDef1 = InventoryItem.create(
        "inv-def-1",
        SKU.create("SKU-DEF-1"),
        "default",
        Quantity.create(30),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      const itemDef2 = InventoryItem.create(
        "inv-def-2",
        SKU.create("SKU-DEF-2"),
        "default",
        Quantity.create(40),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      const itemOther = InventoryItem.create(
        "inv-other",
        SKU.create("SKU-DEF-1"),
        "custom-loc",
        Quantity.create(50),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      await repo.save(itemDef1);
      await repo.save(itemDef2);
      await repo.save(itemOther);

      // Default location lookup
      const defaultResults = await repo.findBySkus([SKU.create("SKU-DEF-1"), SKU.create("SKU-DEF-2")]);
      expect(defaultResults.length).toBe(2);
      expect(defaultResults.every(r => r.locationId === "default")).toBe(true);

      // Custom location lookup
      const customResults = await repo.findBySkus([SKU.create("SKU-DEF-1")], "custom-loc");
      expect(customResults.length).toBe(1);
      expect(customResults[0].locationId).toBe("custom-loc");
    });

    it("should retrieve all inventory items with findAll", async () => {
      const itemA = InventoryItem.create(
        "inv-all-a",
        SKU.create("SKU-A"),
        "loc-1",
        Quantity.create(10),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      const itemB = InventoryItem.create(
        "inv-all-b",
        SKU.create("SKU-B"),
        "loc-2",
        Quantity.create(20),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      await repo.save(itemA);
      await repo.save(itemB);

      const all = await repo.findAll();
      expect(all.length).toBe(2);
    });

    it("should filter items by single and multiple locations", async () => {
      const item1 = InventoryItem.create(
        "inv-l1",
        SKU.create("SKU-L1"),
        "warehouse-1",
        Quantity.create(5),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      const item2 = InventoryItem.create(
        "inv-l2",
        SKU.create("SKU-L2"),
        "warehouse-2",
        Quantity.create(10),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      const item3 = InventoryItem.create(
        "inv-l3",
        SKU.create("SKU-L3"),
        "warehouse-3",
        Quantity.create(15),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      await repo.save(item1);
      await repo.save(item2);
      await repo.save(item3);

      const wh1Items = await repo.findAllByLocation("warehouse-1");
      expect(wh1Items.length).toBe(1);
      expect(wh1Items[0].sku.getValue()).toBe("SKU-L1");

      const multiWhItems = await repo.findAllByLocationIds(["warehouse-1", "warehouse-2"]);
      expect(multiWhItems.length).toBe(2);
      expect(multiWhItems.map(i => i.locationId).sort()).toEqual(["warehouse-1", "warehouse-2"]);
    });

    it("should verify existence with hasAnyEntries", async () => {
      const item = InventoryItem.create(
        "inv-check",
        SKU.create("SKU-CHECK"),
        "loc-check",
        Quantity.create(5),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      await repo.save(item);

      const exists = await repo.hasAnyEntries("SKU-CHECK", "loc-check");
      expect(exists).toBe(true);

      const notExists = await repo.hasAnyEntries("NON-EXISTENT", "loc-check");
      expect(notExists).toBe(false);
    });
  });

  describe("Single Entity Save & Optimistic Concurrency", () => {
    it("should create a new inventory record when it does not exist", async () => {
      const item = InventoryItem.create(
        "inv-new-1",
        SKU.create("SKU-NEW"),
        "loc-new",
        Quantity.create(100),
        Quantity.create(25),
        Quantity.create(10),
        1
      );

      await repo.save(item);

      const record = await prisma.inventoryModel.findUnique({ where: { id: "inv-new-1" } });
      expect(record).not.toBeNull();
      expect(record?.sku).toBe("SKU-NEW");
      expect(record?.quantity).toBe(100);
      expect(record?.allocated).toBe(25);
      expect(record?.inTransit).toBe(10);
      expect(record?.version).toBe(1);
      expect(broadcastSpy).toHaveBeenCalledWith("tenant-1", expect.objectContaining({ type: "stock_changed", sku: "SKU-NEW" }));
    });

    it("should update an existing record and increment version", async () => {
      const item = InventoryItem.create(
        "inv-upd-1",
        SKU.create("SKU-UPD"),
        "loc-upd",
        Quantity.create(50),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      await repo.save(item);

      // Transition entity
      item.allocateStock(Quantity.create(10));
      expect(item.version).toBe(2);

      await repo.save(item);

      const record = await prisma.inventoryModel.findUnique({ where: { id: "inv-upd-1" } });
      expect(record?.allocated).toBe(10);
      expect(record?.version).toBe(2);
    });

    it("should throw ConcurrencyException when saving with stale version", async () => {
      const item = InventoryItem.create(
        "inv-stale-1",
        SKU.create("SKU-STALE"),
        "loc-stale",
        Quantity.create(50),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      await repo.save(item);

      // Simulate a concurrent modification in the DB advancing version to 2
      await prisma.inventoryModel.update({
        where: { id: "inv-stale-1" },
        data: { version: 2 },
      });

      // Attempting to save item expecting version - 1 (1 - 1 = 0 in where clause) will fail
      await expect(repo.save(item)).rejects.toThrow(ConcurrencyException);
    });

    it("should persist domain events with outbox repository when configured", async () => {
      const repoWithOutbox = new PrismaInventoryRepository(mockOutboxRepo);
      const item = InventoryItem.create(
        "inv-outbox-1",
        SKU.create("SKU-OUTBOX"),
        "loc-outbox",
        Quantity.create(20),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      await repoWithOutbox.save(item);

      item.dispatchStock(Quantity.create(20)); // Stock depleted to 0 generates StockDepletedEvent

      await repoWithOutbox.save(item);

      expect(mockOutboxRepo.save).toHaveBeenCalled();
      const savedInDb = await prisma.inventoryModel.findUnique({ where: { id: "inv-outbox-1" } });
      expect(savedInDb?.quantity).toBe(0);
    });
  });

  describe("Batch Operations (saveMany)", () => {
    it("should do nothing when passed an empty array", async () => {
      await expect(repo.saveMany([])).resolves.not.toThrow();
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it("should handle mixed creation and updates in batch without outbox", async () => {
      // Pre-seed an existing item
      const existing = InventoryItem.create(
        "inv-batch-1",
        SKU.create("SKU-B1"),
        "loc-1",
        Quantity.create(10),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      await repo.save(existing);

      // Modify existing
      existing.allocateStock(Quantity.create(5));

      // Create new item
      const newItem = InventoryItem.create(
        "inv-batch-2",
        SKU.create("SKU-B2"),
        "loc-1",
        Quantity.create(50),
        Quantity.create(0),
        Quantity.create(0),
        1
      );

      await repo.saveMany([existing, newItem]);

      const item1 = await prisma.inventoryModel.findUnique({ where: { id: "inv-batch-1" } });
      const item2 = await prisma.inventoryModel.findUnique({ where: { id: "inv-batch-2" } });

      expect(item1?.allocated).toBe(5);
      expect(item1?.version).toBe(2);
      expect(item2?.quantity).toBe(50);
      expect(item2?.version).toBe(1);
    });

    it("should throw ConcurrencyException when a batch update has version mismatch", async () => {
      const existing = InventoryItem.create(
        "inv-batch-stale",
        SKU.create("SKU-STALE-BATCH"),
        "loc-1",
        Quantity.create(10),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      await repo.save(existing);

      // Manually increment version in DB
      await prisma.inventoryModel.update({
        where: { id: "inv-batch-stale" },
        data: { version: 5 },
      });

      // Existing item still expects version 1 in DB
      existing.allocateStock(Quantity.create(2));

      await expect(repo.saveMany([existing])).rejects.toThrow(ConcurrencyException);
    });

    it("should handle mixed creation and updates in batch with outbox repository", async () => {
      const repoWithOutbox = new PrismaInventoryRepository(mockOutboxRepo);

      const existing = InventoryItem.create(
        "inv-outbox-b1",
        SKU.create("SKU-OB1"),
        "loc-1",
        Quantity.create(20),
        Quantity.create(0),
        Quantity.create(0),
        1
      );
      await repoWithOutbox.save(existing);

      existing.dispatchStock(Quantity.create(20)); // Generates StockDepletedEvent

      const newItem = InventoryItem.create(
        "inv-outbox-b2",
        SKU.create("SKU-OB2"),
        "loc-1",
        Quantity.create(80),
        Quantity.create(0),
        Quantity.create(0),
        1
      );

      await repoWithOutbox.saveMany([existing, newItem]);

      expect(mockOutboxRepo.save).toHaveBeenCalled();
      const updatedExisting = await prisma.inventoryModel.findUnique({ where: { id: "inv-outbox-b1" } });
      const createdNew = await prisma.inventoryModel.findUnique({ where: { id: "inv-outbox-b2" } });

      expect(updatedExisting?.quantity).toBe(0);
      expect(createdNew?.quantity).toBe(80);
    });
  });
});
