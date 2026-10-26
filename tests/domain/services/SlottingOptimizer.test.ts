import { SlottingOptimizer } from "../../../src/domain/services/SlottingOptimizer";
import { WarehouseLocation } from "../../../src/domain/product/entities/WarehouseLocation";
import { LocationId } from "../../../src/domain/valueObjects/LocationId";
import { DispatchRecord } from "../../../src/domain/repositories/IDispatchRecordRepository";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";

describe("SlottingOptimizer", () => {
  let mockLocationRepo: any;
  let mockDispatchRepo: any;
  let mockInventoryRepo: any;

  beforeEach(() => {
    mockLocationRepo = {
      findAll: jest.fn(),
    };
    mockDispatchRepo = {
      fetchHistoryByLocation: jest.fn(),
    };
    mockInventoryRepo = {
      findAll: jest.fn(),
    };
  });

  it("should generate suggestions to swap high-velocity items with low-velocity items closer to dispatch", async () => {
    // 1. Setup locations (distance: LOC-A = 2, LOC-B = 10)
    const locA = new WarehouseLocation(
      new LocationId("LOC-A"),
      "WH1", "A", "A01", "R1", "S1", "B1", 1000, 10, 1, 1
    );
    const locB = new WarehouseLocation(
      new LocationId("LOC-B"),
      "WH1", "B", "B01", "R1", "S1", "B1", 1000, 10, 5, 5
    );
    mockLocationRepo.findAll.mockResolvedValue([locA, locB]);

    // 2. Setup dispatches (velocity of SKU-FAST = 100, SKU-SLOW = 10)
    const dispatchFast = new DispatchRecord("d1", "SKU-FAST", "LOC-B", 100, new Date());
    const dispatchSlow = new DispatchRecord("d2", "SKU-SLOW", "LOC-A", 10, new Date());

    mockDispatchRepo.fetchHistoryByLocation.mockImplementation(async (locationId: string) => {
      if (locationId === "LOC-A") return [dispatchSlow];
      if (locationId === "LOC-B") return [dispatchFast];
      return [];
    });

    // 3. Setup current inventory (SKU-FAST is at distant LOC-B, SKU-SLOW is at close LOC-A)
    const itemFast = InventoryItem.create("inv-1", SKU.create("SKU-FAST"), "LOC-B", Quantity.create(10));
    const itemSlow = InventoryItem.create("inv-2", SKU.create("SKU-SLOW"), "LOC-A", Quantity.create(10));
    mockInventoryRepo.findAll.mockResolvedValue([itemFast, itemSlow]);

    const optimizer = new SlottingOptimizer(mockLocationRepo, mockDispatchRepo, mockInventoryRepo);
    const suggestions = await optimizer.generateSuggestions();

    // Verify recommendations
    expect(suggestions).toHaveLength(1);
    const suggestion = suggestions[0];

    expect(suggestion.sku).toBe("SKU-FAST");
    expect(suggestion.currentLocationId).toBe("LOC-B");
    expect(suggestion.currentDistance).toBe(10);
    expect(suggestion.currentVelocity).toBe(100);
    expect(suggestion.recommendedLocationId).toBe("LOC-A");
    expect(suggestion.recommendedDistance).toBe(2);
    expect(suggestion.potentialSwapSku).toBe("SKU-SLOW");

    // distanceDiff = 10 - 2 = 8
    // velocity = 100
    // estimatedSavings = 100 * 8 * 2 = 1600
    expect(suggestion.estimatedSavings).toBe(1600);
  });

  it("should return empty array if no locations or items exist", async () => {
    mockLocationRepo.findAll.mockResolvedValue([]);
    mockInventoryRepo.findAll.mockResolvedValue([]);

    const optimizer = new SlottingOptimizer(mockLocationRepo, mockDispatchRepo, mockInventoryRepo);
    const suggestions = await optimizer.generateSuggestions();
    expect(suggestions).toEqual([]);
  });
});
