import { CalculateSalesVelocity } from "../../../src/application/useCases/CalculateSalesVelocity";
import { IDispatchRecordRepository, DispatchRecord } from "../../../src/domain/repositories/IDispatchRecordRepository";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";

describe("CalculateSalesVelocity Use Case", () => {
  let mockDispatchRepo: jest.Mocked<IDispatchRecordRepository>;
  let mockInventoryRepo: jest.Mocked<IInventoryRepository>;
  let useCase: CalculateSalesVelocity;

  beforeEach(() => {
    mockDispatchRepo = {
      save: jest.fn(),
      fetchHistory: jest.fn(),
      fetchByLotNumber: jest.fn(),
    } as any;

    mockInventoryRepo = {
      findBySku: jest.fn(),
      findAllBySku: jest.fn(),
      findBySkus: jest.fn(),
      findAll: jest.fn(),
      findAllByLocation: jest.fn(),
      save: jest.fn(),
      saveMany: jest.fn(),
      hasAnyEntries: jest.fn(),
      hasConflicts: jest.fn(),
    } as any;

    useCase = new CalculateSalesVelocity(mockDispatchRepo, mockInventoryRepo);

    // Mock Date to a fixed point in time
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2023-01-01T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });



  it("should calculate correct sales velocity with history and existing stock", async () => {
    // 100 stock
    const sku = SKU.create("SKU-123");
    const inventoryItem = InventoryItem.create("inv-1", sku, "loc-1", Quantity.create(100));
    mockInventoryRepo.findBySku.mockResolvedValue(inventoryItem);

    const now = new Date("2023-01-01T12:00:00.000Z");

    const history: DispatchRecord[] = [
      // 7 days window (covers 7, 30, 90) -> 14 total
      new DispatchRecord("1", "SKU-123", "loc-1", 14, new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)),
      // 30 days window (covers 30, 90) -> 16 total
      new DispatchRecord("2", "SKU-123", "loc-1", 16, new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)),
      // 90 days window (covers 90 only) -> 60 total
      new DispatchRecord("3", "SKU-123", "loc-1", 60, new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)),
      // Outside 90 days (should not be returned by repo realistically, but let's assume it isn't based on the query)
    ];

    mockDispatchRepo.fetchHistory.mockResolvedValue(history);

    const result = await useCase.execute("SKU-123", "loc-1");

    expect(mockDispatchRepo.fetchHistory).toHaveBeenCalledWith(
      "SKU-123",
      "loc-1",
      new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    );

    expect(result.sku).toBe("SKU-123");
    expect(result.locationId).toBe("loc-1");
    expect(result.currentStock).toBe(100);

    // Sum 7d = 14, ADS 7d = 14/7 = 2
    expect(result.averageDailySales7d).toBe(2);

    // Sum 30d = 14 + 16 = 30, ADS 30d = 30/30 = 1
    expect(result.averageDailySales30d).toBe(1);

    // Sum 90d = 14 + 16 + 60 = 90, ADS 90d = 90/90 = 1
    expect(result.averageDailySales90d).toBe(1);

    // Days of Cover = Math.ceil(currentStock / ADS 30d) = Math.ceil(100 / 1) = 100
    expect(result.daysOfCover).toBe(100);

    // Run Out Date = now + 100 days
    expect(result.runOutDate).toEqual(new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000));
  });

  it("should handle zero sales correctly (daysOfCover = Infinity)", async () => {
    const sku = SKU.create("SKU-123");
    const inventoryItem = InventoryItem.create("inv-1", sku, "loc-1", Quantity.create(50));
    mockInventoryRepo.findBySku.mockResolvedValue(inventoryItem);
    mockDispatchRepo.fetchHistory.mockResolvedValue([]); // No sales

    const result = await useCase.execute("SKU-123", "loc-1");

    expect(result.averageDailySales7d).toBe(0);
    expect(result.averageDailySales30d).toBe(0);
    expect(result.averageDailySales90d).toBe(0);
    expect(result.daysOfCover).toBe(Infinity);
    expect(result.runOutDate).toBeNull();
  });

  it("should use preFetchedStock and not query inventory repository", async () => {
    mockDispatchRepo.fetchHistory.mockResolvedValue([]);

    const result = await useCase.execute("SKU-123", "loc-1", 75);

    expect(mockInventoryRepo.findBySku).not.toHaveBeenCalled();
    expect(result.currentStock).toBe(75);
    expect(result.daysOfCover).toBe(Infinity);
  });

  it("should handle inventory not found correctly (defaults to 0 stock)", async () => {
    mockInventoryRepo.findBySku.mockResolvedValue(null);
    mockDispatchRepo.fetchHistory.mockResolvedValue([]);

    const result = await useCase.execute("SKU-123", "loc-1");

    expect(mockInventoryRepo.findBySku).toHaveBeenCalled();
    expect(result.currentStock).toBe(0);
  });

  it("should correctly handle boundaries (exactly 7, 30, and 90 days ago)", async () => {
    const now = new Date("2023-01-01T12:00:00.000Z");

    const history: DispatchRecord[] = [
      new DispatchRecord("1", "SKU-123", "loc-1", 7, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
      new DispatchRecord("2", "SKU-123", "loc-1", 30, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
      new DispatchRecord("3", "SKU-123", "loc-1", 90, new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)),
    ];
    mockDispatchRepo.fetchHistory.mockResolvedValue(history);

    const result = await useCase.execute("SKU-123", "loc-1", 100);

    // Sum 7d = 7
    expect(result.averageDailySales7d).toBe(1);

    // Sum 30d = 7 + 30 = 37 -> 37 / 30 = 1.233333 -> toFixed(3) -> 1.233
    expect(result.averageDailySales30d).toBe(1.233);

    // Sum 90d = 7 + 30 + 90 = 127 -> 127 / 90 = 1.411111 -> toFixed(3) -> 1.411
    expect(result.averageDailySales90d).toBe(1.411);
  });

});
