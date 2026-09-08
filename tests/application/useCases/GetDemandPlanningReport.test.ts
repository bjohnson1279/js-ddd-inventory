import { IDispatchRecordRepository } from '../../../src/domain/repositories/IDispatchRecordRepository';
import { GetDemandPlanningReport } from "../../../src/application/useCases/GetDemandPlanningReport";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { IReorderPolicyRepository } from "../../../src/domain/repositories/IReorderPolicyRepository";
import { IDemandForecastRepository, DemandForecast } from "../../../src/domain/repositories/IDemandForecastRepository";
import { CalculateSalesVelocity } from "../../../src/application/useCases/CalculateSalesVelocity";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { ReorderPolicy } from "../../../src/domain/procurement/aggregates/ReorderPolicy";

describe("GetDemandPlanningReport", () => {
  let inventoryRepo: jest.Mocked<IInventoryRepository>;
  let reorderPolicyRepo: any; // using any since it has optional methods that TS complains about mocking
  let demandForecastRepo: jest.Mocked<IDemandForecastRepository>;
  let dispatchRecordRepo: jest.Mocked<IDispatchRecordRepository>;
  let calcSalesVelocity: jest.Mocked<CalculateSalesVelocity>;
  let useCase: GetDemandPlanningReport;

  beforeEach(() => {
    inventoryRepo = {
      findAllByLocation: jest.fn(),
      findBySku: jest.fn(),
      findAllBySku: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      hasAnyEntries: jest.fn(),
    } as any;

    reorderPolicyRepo = {
      findAllByLocation: jest.fn(),
      findBySkuAndLocation: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
    };

    demandForecastRepo = {
      findAllForLocation: jest.fn(),
      save: jest.fn(),
      findForecast: jest.fn(),
    } as any;

    dispatchRecordRepo = {
      fetchHistoryByLocation: jest.fn().mockResolvedValue([]),
    } as any;

    calcSalesVelocity = {
      execute: jest.fn(),
    } as any;

    useCase = new GetDemandPlanningReport(
      inventoryRepo,
      reorderPolicyRepo,
      demandForecastRepo,
      dispatchRecordRepo,
      calcSalesVelocity
    );

    jest.useFakeTimers();
    jest.setSystemTime(new Date("2023-01-01T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should generate a complete report with existing forecasts and policies", async () => {
    const sku1 = SKU.create("SKU-1");
    const item1 = InventoryItem.create("inv-1", sku1, "loc-1", Quantity.create(5));
    inventoryRepo.findAllByLocation.mockResolvedValue([item1]);

    const policy = new ReorderPolicy("pol-1", sku1, "loc-1", 10, 50, 2);
    reorderPolicyRepo.findAllByLocation.mockResolvedValue([policy]);

    const now = new Date("2023-01-01T12:00:00.000Z");
    jest.setSystemTime(now);
    const forecast = new DemandForecast(
      "fc-1",
      "SKU-1",
      "loc-1",
      100,
      new Date(now.getTime() - 1000), // Active now
      new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      0.85,
      now
    );
    demandForecastRepo.findAllForLocation.mockResolvedValue([forecast]);

    calcSalesVelocity.execute.mockResolvedValue({
      sku: "SKU-1",
      locationId: "loc-1",
      currentStock: 5,
      averageDailySales7d: 2,
      averageDailySales30d: 3,
      averageDailySales90d: 2.5,
      daysOfCover: 2,
      runOutDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
    });

    const report = await useCase.execute("loc-1");

    expect(report.length).toBe(1);
    const item = report[0];

    expect(item.sku).toBe("SKU-1");
    expect(item.currentStock).toBe(5);
    expect(item.actionRequired).toBe(true); // Stock (5) <= Reorder Point (10)
    expect(item.recommendedOrderQuantity).toBe(50);
    expect(item.reorderPoint).toBe(10);
    expect(item.forecastedDemand30d).toBe(100);
    expect(item.confidenceLevel).toBe(0.85);
  });

  it("should handle missing optional reorderPolicy methods gracefully", async () => {
    // Override use case with a repo that doesn't have findAllByLocation
    const customReorderRepo = {
      findBySkuAndLocation: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
    } as any;

    useCase = new GetDemandPlanningReport(
      inventoryRepo,
      customReorderRepo,
      demandForecastRepo,
      dispatchRecordRepo,
      calcSalesVelocity
    );

    const sku1 = SKU.create("SKU-1");
    const item1 = InventoryItem.create("inv-1", sku1, "loc-1", Quantity.create(15));
    inventoryRepo.findAllByLocation.mockResolvedValue([item1]);
    demandForecastRepo.findAllForLocation.mockResolvedValue([]);
    customReorderRepo.findBySkuAndLocation.mockResolvedValue(null);

    calcSalesVelocity.execute.mockResolvedValue({
      sku: "SKU-1",
      locationId: "loc-1",
      currentStock: 15,
      averageDailySales7d: 1,
      averageDailySales30d: 1,
      averageDailySales90d: 1,
      daysOfCover: 15,
      runOutDate: new Date(new Date("2023-01-01T12:00:00.000Z").getTime() + 15 * 24 * 60 * 60 * 1000),
    });

    const report = await useCase.execute("loc-1");

    expect(report.length).toBe(1);
    const item = report[0];
    expect(item.reorderPoint).toBe(10); // Default fallback
    expect(item.reorderQuantity).toBe(20); // Default fallback
    expect(item.actionRequired).toBe(false); // 15 > 10
    expect(item.recommendedOrderQuantity).toBe(0);
    expect(customReorderRepo.findBySkuAndLocation).toHaveBeenCalled();
  });

  it("should calculate fallback forecastedDemand30d when no active forecast exists", async () => {
    const sku1 = SKU.create("SKU-1");
    const item1 = InventoryItem.create("inv-1", sku1, "loc-1", Quantity.create(15));
    inventoryRepo.findAllByLocation.mockResolvedValue([item1]);
    reorderPolicyRepo.findAllByLocation.mockResolvedValue([]);
    demandForecastRepo.findAllForLocation.mockResolvedValue([]);

    // We expect forecastedDemand30d to be averageDailySales30d * 30
    calcSalesVelocity.execute.mockResolvedValue({
      sku: "SKU-1",
      locationId: "loc-1",
      currentStock: 15,
      averageDailySales7d: 2,
      averageDailySales30d: 2.5,
      averageDailySales90d: 2,
      daysOfCover: 6,
      runOutDate: null,
    });

    const report = await useCase.execute("loc-1");

    expect(report.length).toBe(1);
    const item = report[0];

    // Math.ceil(2.5 * 30) = Math.ceil(75) = 75
    expect(item.forecastedDemand30d).toBe(75);
    expect(item.confidenceLevel).toBe(0.70); // fallback for velocity > 0
  });

  it("should return confidence level of 0.50 if no forecast and zero velocity", async () => {
    const sku1 = SKU.create("SKU-1");
    const item1 = InventoryItem.create("inv-1", sku1, "loc-1", Quantity.create(15));
    inventoryRepo.findAllByLocation.mockResolvedValue([item1]);
    reorderPolicyRepo.findAllByLocation.mockResolvedValue([]);
    demandForecastRepo.findAllForLocation.mockResolvedValue([]);

    calcSalesVelocity.execute.mockResolvedValue({
      sku: "SKU-1",
      locationId: "loc-1",
      currentStock: 15,
      averageDailySales7d: 0,
      averageDailySales30d: 0,
      averageDailySales90d: 0,
      daysOfCover: Infinity,
      runOutDate: null,
    });

    const report = await useCase.execute("loc-1");

    expect(report.length).toBe(1);
    const item = report[0];
    expect(item.forecastedDemand30d).toBe(0);
    expect(item.confidenceLevel).toBe(0.50);
  });

  it("should use default locationId when no locationId is provided", async () => {
    const sku1 = SKU.create("SKU-1");
    const item1 = InventoryItem.create("inv-1", sku1, "default", Quantity.create(15));
    inventoryRepo.findAllByLocation.mockResolvedValue([item1]);

    // Create a mock repo for reorder policy like in earlier tests
    const customReorderRepo = {
      findBySkuAndLocation: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
    } as any;

    useCase = new GetDemandPlanningReport(
      inventoryRepo,
      customReorderRepo,
      demandForecastRepo,
      dispatchRecordRepo,
      calcSalesVelocity
    );

    demandForecastRepo.findAllForLocation.mockResolvedValue([]);

    calcSalesVelocity.execute.mockResolvedValue({
      sku: "SKU-1",
      locationId: "default",
      currentStock: 15,
      averageDailySales7d: 0,
      averageDailySales30d: 0,
      averageDailySales90d: 0,
      daysOfCover: Infinity,
      runOutDate: null,
    });

    const report = await useCase.execute();

    expect(report.length).toBe(1);
    expect(inventoryRepo.findAllByLocation).toHaveBeenCalledWith("default");
    expect(demandForecastRepo.findAllForLocation).toHaveBeenCalledWith("default");
  });

  it("should ignore inactive forecasts (past or future) and duplicate forecasts", async () => {
    const sku1 = SKU.create("SKU-1");
    const item1 = InventoryItem.create("inv-1", sku1, "loc-1", Quantity.create(15));
    inventoryRepo.findAllByLocation.mockResolvedValue([item1]);

    const customReorderRepo = {
      findBySkuAndLocation: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
    } as any;

    useCase = new GetDemandPlanningReport(
      inventoryRepo,
      customReorderRepo,
      demandForecastRepo,
      dispatchRecordRepo,
      calcSalesVelocity
    );

    const now = new Date("2023-01-01T12:00:00.000Z");
    jest.setSystemTime(now);

    // Past forecast
    const pastForecast = {
      sku: "SKU-1",
      forecastedQuantity: 50,
      periodStart: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
      periodEnd: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      confidenceLevel: 0.90,
    } as any;

    // Future forecast
    const futureForecast = {
      sku: "SKU-1",
      forecastedQuantity: 150,
      periodStart: new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000),
      periodEnd: new Date(now.getTime() + 70 * 24 * 60 * 60 * 1000),
      confidenceLevel: 0.90,
    } as any;

    // Active forecast 1
    const activeForecast1 = {
      sku: "SKU-1",
      forecastedQuantity: 200,
      periodStart: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      periodEnd: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000),
      confidenceLevel: 0.80,
    } as any;

    // Active forecast 2 (Duplicate for same SKU)
    const activeForecast2 = {
      sku: "SKU-1",
      forecastedQuantity: 300,
      periodStart: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      periodEnd: new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000),
      confidenceLevel: 0.95,
    } as any;

    demandForecastRepo.findAllForLocation.mockResolvedValue([
      pastForecast,
      futureForecast,
      activeForecast1,
      activeForecast2
    ]);

    calcSalesVelocity.execute.mockResolvedValue({
      sku: "SKU-1",
      locationId: "loc-1",
      currentStock: 15,
      averageDailySales7d: 2,
      averageDailySales30d: 2.5,
      averageDailySales90d: 2,
      daysOfCover: 6,
      runOutDate: null,
    });

    const report = await useCase.execute("loc-1");

    expect(report.length).toBe(1);
    const item = report[0];

    // Should pick activeForecast1 because it was the first active one encountered (due to !activeForecastsMap.has(f.sku))
    expect(item.forecastedDemand30d).toBe(200);
    expect(item.confidenceLevel).toBe(0.80);
  });
});
