import { SlottingOptimizer } from '../../../src/domain/services/SlottingOptimizer';
import { PrismaClient } from '@prisma/client';

describe('SlottingOptimizer', () => {
  let optimizer: SlottingOptimizer;
  let mockPrisma: any;
  let originalConsoleWarn: any;

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

    // Default mock behavior to not throw errors
    mockPrisma.warehouseLocationModel.findMany.mockResolvedValue([]);
    mockPrisma.dispatchRecordModel.findMany.mockResolvedValue([]);
    mockPrisma.inventoryModel.findMany.mockResolvedValue([]);

    optimizer = new SlottingOptimizer(mockPrisma as unknown as PrismaClient);

    // Mock global fetch to simulate sidecar being down
    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

    // Suppress console.warn during tests
    originalConsoleWarn = console.warn;
    console.warn = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    console.warn = originalConsoleWarn;
  });

  it('should return empty array if no locations exist', async () => {
    mockPrisma.warehouseLocationModel.findMany.mockResolvedValue([]);
    const result = await optimizer.generateSuggestions();
    expect(result).toEqual([]);
  });

  it('should return empty array if no inventory exists', async () => {
    mockPrisma.warehouseLocationModel.findMany.mockResolvedValue([
      { id: 'L1', gridX: 1, gridY: 1 }
    ]);
    mockPrisma.inventoryModel.findMany.mockResolvedValue([]);
    const result = await optimizer.generateSuggestions();
    expect(result).toEqual([]);
  });

  it('should fallback to basic heuristic when fetch fails', async () => {
    mockPrisma.warehouseLocationModel.findMany.mockResolvedValue([
      { id: 'L1', gridX: 10, gridY: 10 },
      { id: 'L2', gridX: 1, gridY: 1 }
    ]);
    mockPrisma.dispatchRecordModel.findMany.mockResolvedValue([
      { sku: 'ITEM-1', locationId: 'L1', quantity: 100, dispatchedAt: new Date() }
    ]);
    mockPrisma.inventoryModel.findMany.mockResolvedValue([
      { sku: 'ITEM-1', locationId: 'L1' }, // Currently in L1 (distance 20)
      { sku: 'ITEM-2', locationId: 'L2' }  // Currently in L2 (distance 2)
    ]);

    const result = await optimizer.generateSuggestions();

    // ITEM-1 is high velocity (100) and is far away (L1, dist 20).
    // ITEM-2 is low velocity (0) and is close (L2, dist 2).
    // It should suggest swapping ITEM-1 to L2.
    // Distance diff = 20 - 2 = 18. Savings = velocity (100) * diff (18) * 2 = 3600.

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      sku: 'ITEM-1',
      currentLocationId: 'L1',
      currentDistance: 20,
      currentVelocity: 100,
      recommendedLocationId: 'L2',
      recommendedDistance: 2,
      potentialSwapSku: 'ITEM-2',
      estimatedSavings: 3600
    });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[JS SlottingOptimizer] Python sidecar down'));
  });

  it('should return sidecar response when fetch succeeds', async () => {
    const locations = [{ id: 'L1', gridX: 10, gridY: 10 }];
    const inventory = [{ sku: 'ITEM-1', locationId: 'L1' }];
    const dispatches: any[] = [];

    mockPrisma.warehouseLocationModel.findMany.mockResolvedValue(locations);
    mockPrisma.inventoryModel.findMany.mockResolvedValue(inventory);
    mockPrisma.dispatchRecordModel.findMany.mockResolvedValue(dispatches);

    const mockSuggestion = {
      sku: 'ITEM-1',
      currentLocationId: 'L1',
      currentDistance: 20,
      currentVelocity: 100,
      recommendedLocationId: 'L2',
      recommendedDistance: 2,
      estimatedSavings: 1000
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockSuggestion])
    } as Response);

    const result = await optimizer.generateSuggestions();

    expect(result).toEqual([mockSuggestion]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5005/optimize',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String)
      })
    );
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should return empty array if there is location but no item", async () => {
    mockPrisma.warehouseLocationModel.findMany.mockResolvedValue([
      { id: "LOC-A", gridX: 1, gridY: 1 }
    ]);
    mockPrisma.inventoryModel.findMany.mockResolvedValue([]);

    const optimizer = new SlottingOptimizer(mockPrisma);
    const suggestions = await optimizer.generateSuggestions();
    expect(suggestions).toEqual([]);
  });

  it("should return parsed json when fetch to sidecar is successful", async () => {
    mockPrisma.warehouseLocationModel.findMany.mockResolvedValue([
      { id: "LOC-A", gridX: 1, gridY: 1 }
    ]);
    mockPrisma.dispatchRecordModel.findMany.mockResolvedValue([]);
    mockPrisma.inventoryModel.findMany.mockResolvedValue([
      { sku: "SKU-FAST", locationId: "LOC-A" }
    ]);

    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve([{ sku: "SKU-FAST", estimatedSavings: 100 }])
    })) as jest.Mock;

    const optimizer = new SlottingOptimizer(mockPrisma);
    const suggestions = await optimizer.generateSuggestions();

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].sku).toBe("SKU-FAST");
    expect(suggestions[0].estimatedSavings).toBe(100);

    (global.fetch as jest.Mock).mockRestore();
  });

  it("should handle error when python sidecar fetch fails", async () => {
    mockPrisma.warehouseLocationModel.findMany.mockResolvedValue([
      { id: "LOC-A", gridX: 1, gridY: 1 },
      { id: "LOC-B", gridX: 5, gridY: 5 },
    ]);

    mockPrisma.dispatchRecordModel.findMany.mockResolvedValue([
      { sku: "SKU-FAST", locationId: "LOC-B", quantity: 100 },
      { sku: "SKU-SLOW", locationId: "LOC-A", quantity: 10 },
    ]);

    mockPrisma.inventoryModel.findMany.mockResolvedValue([
      { sku: "SKU-FAST", locationId: "LOC-B" },
      { sku: "SKU-SLOW", locationId: "LOC-A" },
    ]);

    global.fetch = jest.fn(() => Promise.reject(new Error("Connection refused")));
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const optimizer = new SlottingOptimizer(mockPrisma);
    const suggestions = await optimizer.generateSuggestions();

    expect(consoleSpy).toHaveBeenCalledWith("[JS SlottingOptimizer] Python sidecar down. Fallback to basic: Connection refused");
    expect(suggestions).toHaveLength(1);

    consoleSpy.mockRestore();
    (global.fetch as jest.Mock).mockRestore();
  });
});
