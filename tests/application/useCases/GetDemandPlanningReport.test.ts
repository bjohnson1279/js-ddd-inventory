import { GetDemandPlanningReport } from "../../../src/application/useCases/GetDemandPlanningReport";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { IReorderPolicyRepository } from "../../../src/domain/repositories/IReorderPolicyRepository";
import { IDemandForecastRepository, DemandForecast } from "../../../src/domain/repositories/IDemandForecastRepository";
import { CalculateSalesVelocity, SalesVelocityResult } from "../../../src/application/useCases/CalculateSalesVelocity";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { ReorderPolicy } from "../../../src/domain/procurement/aggregates/ReorderPolicy";

describe("GetDemandPlanningReport Use Case", () => {
  let mockInventoryRepo: jest.Mocked<IInventoryRepository>;
  let mockReorderPolicyRepo: jest.Mocked<IReorderPolicyRepository>;
  let mockDemandForecastRepo: jest.Mocked<IDemandForecastRepository>;
  let mockCalculateSalesVelocity: jest.Mocked<CalculateSalesVelocity>;
  let useCase: GetDemandPlanningReport;

  beforeEach(() => {
    mockInventoryRepo = {
      findAllByLocation: jest.fn(),
    } as any;

    mockReorderPolicyRepo = {
      findAllByLocation: jest.fn(),
      findBySkuAndLocation: jest.fn(),
    } as any;

    mockDemandForecastRepo = {
      findAllForLocation: jest.fn(),
    } as any;

    mockCalculateSalesVelocity = {
      execute: jest.fn(),
    } as any;

    useCase = new GetDemandPlanningReport(
      mockInventoryRepo,
      mockReorderPolicyRepo,
      mockDemandForecastRepo,
      mockCalculateSalesVelocity
    );

    jest.useFakeTimers();
    jest.setSystemTime(new Date("2023-01-01T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should generate a demand planning report item successfully", async () => {
    const locationId = "loc-1";
    const sku1Str = "SKU-1";
    const sku1 = SKU.create(sku1Str);

    const inventoryItems = [
      InventoryItem.create("inv-1", sku1, locationId, Quantity.create(15))
    ];
    mockInventoryRepo.findAllByLocation.mockResolvedValue(inventoryItems);

    const policies = [
      new ReorderPolicy("pol-1", sku1, locationId, 10, 20, 5, false)
    ];
    (mockReorderPolicyRepo.findAllByLocation as jest.Mock).mockResolvedValue(policies);

    const now = new Date("2023-01-01T12:00:00.000Z");
    const periodStart = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // Active now
    const periodEnd = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // Ends in 15 days
    const forecasts = [
      new DemandForecast("for-1", sku1Str, locationId, 50, periodStart, periodEnd, 0.85, now)
    ];
    mockDemandForecastRepo.findAllForLocation.mockResolvedValue(forecasts);

    const velocityResult: SalesVelocityResult = {
      sku: sku1Str,
      locationId: locationId,
      currentStock: 15,
      averageDailySales7d: 2,
      averageDailySales30d: 1.5,
      averageDailySales90d: 1,
      daysOfCover: 10,
      runOutDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
    };
    mockCalculateSalesVelocity.execute.mockResolvedValue(velocityResult);

    const report = await useCase.execute(locationId);

    expect(mockInventoryRepo.findAllByLocation).toHaveBeenCalledWith(locationId);
    expect(mockReorderPolicyRepo.findAllByLocation).toHaveBeenCalledWith(locationId);
    expect(mockDemandForecastRepo.findAllForLocation).toHaveBeenCalledWith(locationId);
    expect(mockCalculateSalesVelocity.execute).toHaveBeenCalledWith(sku1Str, locationId, 15, undefined);

    expect(report).toHaveLength(1);
    expect(report[0]).toEqual({
      sku: sku1Str,
      locationId,
      currentStock: 15,
      averageDailySales7d: 2,
      averageDailySales30d: 1.5,
      averageDailySales90d: 1,
      daysOfCover: 10,
      runOutDate: velocityResult.runOutDate,

      reorderPoint: 10,
      reorderQuantity: 20,
      safetyStock: 5,

      forecastedDemand30d: 50,
      confidenceLevel: 0.85,

      actionRequired: false,
      recommendedOrderQuantity: 0
    });
  });

  it("should generate a demand planning report with default policy and forecast if missing", async () => {
    const locationId = "loc-2";
    const skuStr = "SKU-2";
    const sku = SKU.create(skuStr);

    // stock <= default reorder point (10)
    const inventoryItems = [
      InventoryItem.create("inv-2", sku, locationId, Quantity.create(5))
    ];
    mockInventoryRepo.findAllByLocation.mockResolvedValue(inventoryItems);

    // No policies found
    (mockReorderPolicyRepo.findAllByLocation as jest.Mock).mockResolvedValue([]);
    mockReorderPolicyRepo.findBySkuAndLocation.mockResolvedValue(null);

    // No forecasts found
    mockDemandForecastRepo.findAllForLocation.mockResolvedValue([]);

    const now = new Date("2023-01-01T12:00:00.000Z");
    const velocityResult: SalesVelocityResult = {
      sku: skuStr,
      locationId: locationId,
      currentStock: 5,
      averageDailySales7d: 3,
      averageDailySales30d: 2, // ADS30 = 2 -> 30d forecast = 2 * 30 = 60
      averageDailySales90d: 2,
      daysOfCover: 2.5,
      runOutDate: new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000)
    };
    mockCalculateSalesVelocity.execute.mockResolvedValue(velocityResult);

    const report = await useCase.execute(locationId);

    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({
      sku: skuStr,
      locationId,
      currentStock: 5,

      // Default policy values
      reorderPoint: 10,
      reorderQuantity: 20,
      safetyStock: 5,

      // Calculated forecast
      forecastedDemand30d: 60,
      confidenceLevel: 0.70,

      // Action required because 5 <= 10
      actionRequired: true,
      recommendedOrderQuantity: 20
    });
  });

  it("should handle low confidence level when ADS > 0 but no forecast exists", async () => {
    const locationId = "loc-3";
    const skuStr = "SKU-3";
    const sku = SKU.create(skuStr);

    mockInventoryRepo.findAllByLocation.mockResolvedValue([
      InventoryItem.create("inv-3", sku, locationId, Quantity.create(10))
    ]);

    (mockReorderPolicyRepo.findAllByLocation as jest.Mock).mockResolvedValue([]);
    mockDemandForecastRepo.findAllForLocation.mockResolvedValue([]);

    const velocityResult: SalesVelocityResult = {
      sku: skuStr,
      locationId: locationId,
      currentStock: 10,
      averageDailySales7d: 0,
      averageDailySales30d: 0,
      averageDailySales90d: 0,
      daysOfCover: Infinity,
      runOutDate: null
    };
    mockCalculateSalesVelocity.execute.mockResolvedValue(velocityResult);

    const report = await useCase.execute(locationId);

    expect(report[0].confidenceLevel).toBe(0.50); // Since ADS30 is 0
  });

  it("should correctly handle missing findAllByLocation on reorderPolicyRepository", async () => {
    const locationId = "loc-4";
    const skuStr = "SKU-4";
    const sku = SKU.create(skuStr);

    mockInventoryRepo.findAllByLocation.mockResolvedValue([
      InventoryItem.create("inv-4", sku, locationId, Quantity.create(50))
    ]);

    // Simulate repo not implementing findAllByLocation
    const originalFindAllByLocation = mockReorderPolicyRepo.findAllByLocation;
    delete mockReorderPolicyRepo.findAllByLocation;

    const customPolicy = new ReorderPolicy("pol-4", sku, locationId, 60, 100, 20, false);
    mockReorderPolicyRepo.findBySkuAndLocation.mockResolvedValue(customPolicy);
    mockDemandForecastRepo.findAllForLocation.mockResolvedValue([]);

    const velocityResult: SalesVelocityResult = {
      sku: skuStr,
      locationId: locationId,
      currentStock: 50,
      averageDailySales7d: 0,
      averageDailySales30d: 0,
      averageDailySales90d: 0,
      daysOfCover: Infinity,
      runOutDate: null
    };
    mockCalculateSalesVelocity.execute.mockResolvedValue(velocityResult);

    const report = await useCase.execute(locationId);

    expect(mockReorderPolicyRepo.findBySkuAndLocation).toHaveBeenCalledWith(sku, locationId);
    expect(report[0].reorderPoint).toBe(60);
    expect(report[0].reorderQuantity).toBe(100);
    expect(report[0].actionRequired).toBe(true); // 50 <= 60
    expect(report[0].recommendedOrderQuantity).toBe(100);

    // Restore for other tests if needed
    mockReorderPolicyRepo.findAllByLocation = originalFindAllByLocation;
  });
});
