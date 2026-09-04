import { Pool } from "pg";
import { PostgresInventoryRepository } from "../../../src/infrastructure/database/PostgresInventoryRepository";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { ConcurrencyException } from "../../../src/domain/exceptions/ConcurrencyException";

jest.mock("pg", () => {
  const mPool = {
    query: jest.fn(),
    connect: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

describe("PostgresInventoryRepository", () => {
  let repository: PostgresInventoryRepository;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PostgresInventoryRepository({});
    mockPool = (Pool as unknown as jest.Mock).mock.results[0].value;
  });

  describe("initialize", () => {
    it("should create inventory_items table", async () => {
      mockPool.query.mockResolvedValueOnce({});
      await repository.initialize();
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query.mock.calls[0][0]).toContain("CREATE TABLE IF NOT EXISTS inventory_items");
    });
  });

  describe("findBySku", () => {
    it("should return null if no item found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const result = await repository.findBySku(SKU.create("SKU-1"));
      expect(result).toBeNull();
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM inventory_items WHERE sku = $1 LIMIT 1",
        ["SKU-1"]
      );
    });

    it("should return an item if found without locationId", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: "item-1",
          sku: "SKU-1",
          location_id: "loc-1",
          quantity: 10,
          allocated: 2,
          in_transit: 0,
          version: 1,
          shopify_inventory_item_id: "shop-1"
        }]
      });
      const result = await repository.findBySku(SKU.create("SKU-1"));
      expect(result).toBeInstanceOf(InventoryItem);
      expect(result?.id).toBe("item-1");
      expect(result?.sku.getValue()).toBe("SKU-1");
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM inventory_items WHERE sku = $1 LIMIT 1",
        ["SKU-1"]
      );
    });

    it("should return an item if found with locationId", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: "item-1",
          sku: "SKU-1",
          location_id: "loc-1",
          quantity: 10,
          allocated: 2,
          in_transit: 0,
          version: 1
        }]
      });
      const result = await repository.findBySku(SKU.create("SKU-1"), "loc-1");
      expect(result).toBeInstanceOf(InventoryItem);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM inventory_items WHERE sku = $1 AND location_id = $2",
        ["SKU-1", "loc-1"]
      );
    });
  });

  describe("findAllBySku", () => {
    it("should return a list of items for a SKU", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: "item-1",
          sku: "SKU-1",
          location_id: "loc-1",
          quantity: 10,
          allocated: 2,
          in_transit: 0,
          version: 1
        }]
      });
      const result = await repository.findAllBySku(SKU.create("SKU-1"));
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(InventoryItem);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM inventory_items WHERE sku = $1",
        ["SKU-1"]
      );
    });
  });

  describe("findBySkus", () => {
    it("should return a list of items for multiple SKUs", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: "item-1",
          sku: "SKU-1",
          location_id: "default",
          quantity: 10,
          allocated: 2,
          in_transit: 0,
          version: 1
        }]
      });
      const result = await repository.findBySkus([SKU.create("SKU-1")], "default");
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(InventoryItem);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM inventory_items WHERE sku = ANY($1) AND location_id = $2",
        [["SKU-1"], "default"]
      );
    });
  });

  describe("findAll", () => {
    it("should return all items", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: "item-1",
          sku: "SKU-1",
          location_id: "loc-1",
          quantity: 10,
          allocated: 2,
          in_transit: 0,
          version: 1
        }]
      });
      const result = await repository.findAll();
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(InventoryItem);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM inventory_items"
      );
    });
  });

  describe("findAllByLocation", () => {
    it("should return items for a location", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: "item-1",
          sku: "SKU-1",
          location_id: "loc-1",
          quantity: 10,
          allocated: 2,
          in_transit: 0,
          version: 1
        }]
      });
      const result = await repository.findAllByLocation("loc-1");
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(InventoryItem);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM inventory_items WHERE location_id = $1",
        ["loc-1"]
      );
    });
  });

  describe("save", () => {
    it("should insert a new item if it does not exist", async () => {
      const item = InventoryItem.create("item-1", SKU.create("SKU-1"), "loc-1", Quantity.create(10), Quantity.create(0), Quantity.create(0), 1, "shop-1");

      mockPool.query.mockResolvedValueOnce({ rows: [] }); // existing check
      mockPool.query.mockResolvedValueOnce({}); // insert

      await repository.save(item);

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        "SELECT version FROM inventory_items WHERE id = $1",
        ["item-1"]
      );
      expect(mockPool.query.mock.calls[1][0]).toContain("INSERT INTO inventory_items");
      expect(mockPool.query.mock.calls[1][1]).toEqual([
        "item-1", "SKU-1", "loc-1", 10, 0, 0, 1, "shop-1"
      ]);
    });

    it("should update an item if it exists", async () => {
      const item = InventoryItem.create("item-1", SKU.create("SKU-1"), "loc-1", Quantity.create(10), Quantity.create(0), Quantity.create(0), 2, "shop-1");

      mockPool.query.mockResolvedValueOnce({ rows: [{ version: 1 }] }); // existing check
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // update

      await repository.save(item);

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(mockPool.query.mock.calls[1][0]).toContain("UPDATE inventory_items");
      expect(mockPool.query.mock.calls[1][1]).toEqual([
        10, 0, 0, 2, "shop-1", "item-1", 1
      ]);
    });

    it("should throw ConcurrencyException on update if rowCount is 0", async () => {
      const item = InventoryItem.create("item-1", SKU.create("SKU-1"), "loc-1", Quantity.create(10), Quantity.create(0), Quantity.create(0), 2, "shop-1");

      mockPool.query.mockResolvedValueOnce({ rows: [{ version: 1 }] }); // existing check
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 }); // update

      await expect(repository.save(item)).rejects.toThrow(ConcurrencyException);
    });
  });

  describe("saveMany", () => {
    it("should insert or update multiple items within a transaction", async () => {
      const item1 = InventoryItem.create("item-1", SKU.create("SKU-1"), "loc-1", Quantity.create(10), Quantity.create(0), Quantity.create(0), 1, "shop-1");
      const item2 = InventoryItem.create("item-2", SKU.create("SKU-2"), "loc-2", Quantity.create(20), Quantity.create(0), Quantity.create(0), 2, "shop-2");

      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((query) => {
        if (query === "BEGIN") return Promise.resolve();
        if (query === "COMMIT") return Promise.resolve();
        if (query.includes("SELECT id, version FROM inventory_items WHERE id = ANY($1)")) {
          return Promise.resolve({ rows: [{ id: "item-2", version: 1 }] });
        }
        if (query.includes("INSERT INTO inventory_items")) {
          return Promise.resolve({});
        }
        if (query.includes("UPDATE inventory_items")) {
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve();
      });

      await repository.saveMany([item1, item2]);

      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();

      // Should check existence of item ids
      const selectCall = mockClient.query.mock.calls.find(call => call[0].includes("SELECT id, version"));
      expect(selectCall[1]).toEqual([["item-1", "item-2"]]);

      const insertCall = mockClient.query.mock.calls.find(call => call[0].includes("INSERT INTO"));
      expect(insertCall[1]).toEqual(["item-1", "SKU-1", "loc-1", 10, 0, 0, 1, "shop-1"]);

      const updateCall = mockClient.query.mock.calls.find(call => call[0].includes("UPDATE"));
      expect(updateCall[1]).toEqual([20, 0, 0, 2, "shop-2", "item-2", 1]);
    });

    it("should throw ConcurrencyException and rollback on update if rowCount is 0", async () => {
      const item2 = InventoryItem.create("item-2", SKU.create("SKU-2"), "loc-2", Quantity.create(20), Quantity.create(0), Quantity.create(0), 2, "shop-2");

      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((query) => {
        if (query === "BEGIN") return Promise.resolve();
        if (query === "ROLLBACK") return Promise.resolve();
        if (query.includes("SELECT id, version")) {
          return Promise.resolve({ rows: [{ id: "item-2", version: 1 }] });
        }
        if (query.includes("UPDATE inventory_items")) {
          return Promise.resolve({ rowCount: 0 }); // Simulates concurrency failure
        }
        return Promise.resolve();
      });

      await expect(repository.saveMany([item2])).rejects.toThrow(ConcurrencyException);
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should rollback and throw if an error occurs", async () => {
      const item1 = InventoryItem.create("item-1", SKU.create("SKU-1"), "loc-1", Quantity.create(10), Quantity.create(0), Quantity.create(0), 1, "shop-1");
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((query) => {
        if (query === "BEGIN") return Promise.resolve();
        if (query.includes("SELECT id, version")) {
          return Promise.reject(new Error("DB Error"));
        }
        return Promise.resolve();
      });

      await expect(repository.saveMany([item1])).rejects.toThrow("DB Error");
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("hasAnyEntries", () => {
    it("should return true if entries exist", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
      const result = await repository.hasAnyEntries("SKU-1", "loc-1");
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT 1 FROM inventory_items WHERE sku = $1 AND location_id = $2 LIMIT 1",
        ["SKU-1", "loc-1"]
      );
    });

    it("should return false if no entries exist", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const result = await repository.hasAnyEntries("SKU-1", "loc-1");
      expect(result).toBe(false);
    });
  });
});
