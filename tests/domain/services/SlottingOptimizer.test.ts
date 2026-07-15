import { SlottingOptimizer } from "../../../src/domain/services/SlottingOptimizer";

describe("SlottingOptimizer", () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      warehouseLocationModel: {
        findMany: jest.fn(),
      },
      dispatchRecordModel: {
        findMany: jest.fn(),
      },
      inventoryModel: {
        findMany: jest.fn(),
      },
    };
  });

  it("should generate suggestions to swap high-velocity items with low-velocity items closer to dispatch", async () => {
    // 1. Setup locations (distance: LOC-A = 2, LOC-B = 10)
    mockPrisma.warehouseLocationModel.findMany.mockResolvedValue([
      { id: "LOC-A", gridX: 1, gridY: 1 },
      { id: "LOC-B", gridX: 5, gridY: 5 },
    ]);

    // 2. Setup dispatches (velocity of SKU-FAST = 100, SKU-SLOW = 10)
    mockPrisma.dispatchRecordModel.findMany.mockResolvedValue([
      { sku: "SKU-FAST", locationId: "LOC-B", quantity: 100 },
      { sku: "SKU-SLOW", locationId: "LOC-A", quantity: 10 },
    ]);

    // 3. Setup current inventory (SKU-FAST is at distant LOC-B, SKU-SLOW is at close LOC-A)
    mockPrisma.inventoryModel.findMany.mockResolvedValue([
      { sku: "SKU-FAST", locationId: "LOC-B" },
      { sku: "SKU-SLOW", locationId: "LOC-A" },
    ]);

    const optimizer = new SlottingOptimizer(mockPrisma);
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
    mockPrisma.warehouseLocationModel.findMany.mockResolvedValue([]);
    mockPrisma.inventoryModel.findMany.mockResolvedValue([]);

    const optimizer = new SlottingOptimizer(mockPrisma);
    const suggestions = await optimizer.generateSuggestions();
    expect(suggestions).toEqual([]);
  });
});
