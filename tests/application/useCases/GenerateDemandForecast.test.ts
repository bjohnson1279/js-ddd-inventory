import { GenerateDemandForecast } from "../../../src/application/useCases/GenerateDemandForecast";
import { IDemandForecastRepository } from "../../../src/domain/repositories/IDemandForecastRepository";
import { IDispatchRecordRepository, DispatchRecord } from "../../../src/domain/repositories/IDispatchRecordRepository";
import { CalculateSalesVelocity } from "../../../src/application/useCases/CalculateSalesVelocity";

describe("GenerateDemandForecast Use Case", () => {
  let mockDemandForecastRepo: jest.Mocked<IDemandForecastRepository>;
  let mockDispatchRecordRepo: jest.Mocked<IDispatchRecordRepository>;
  let mockCalculateSalesVelocity: jest.Mocked<CalculateSalesVelocity>;
  let useCase: GenerateDemandForecast;

  beforeEach(() => {
    mockDemandForecastRepo = {
      save: jest.fn(),
      findForecast: jest.fn(),
      findAllForLocation: jest.fn(),
    } as any;

    mockDispatchRecordRepo = {
      save: jest.fn(),
      fetchHistory: jest.fn(),
      fetchByLotNumber: jest.fn(),
    } as any;

    mockCalculateSalesVelocity = {
      execute: jest.fn(),
    } as any;

    useCase = new GenerateDemandForecast(
      mockDemandForecastRepo,
      mockCalculateSalesVelocity,
      mockDispatchRecordRepo
    );

    jest.useFakeTimers();
    jest.setSystemTime(new Date("2023-05-15T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should generate basic forecast without historical data", async () => {
    mockCalculateSalesVelocity.execute.mockResolvedValue({
      sku: "SKU-123",
      locationId: "loc-1",
      currentStock: 100,
      averageDailySales7d: 10,
      averageDailySales30d: 5,
      averageDailySales90d: 5,
      daysOfCover: 20,
      runOutDate: new Date(),
    });

    mockDispatchRecordRepo.fetchHistory.mockResolvedValue([]);

    const result = await useCase.execute({
      sku: "SKU-123",
      locationId: "loc-1",
      forecastDays: 30,
    });

    expect(mockCalculateSalesVelocity.execute).toHaveBeenCalledWith("SKU-123", "loc-1");
    expect(mockDispatchRecordRepo.fetchHistory).toHaveBeenCalled();
    expect(result.forecastedQuantity).toBe(150); // 5 (ADS 30d) * 30 (forecastDays) * 1.0 (trend) * 1.0 (seasonal)
    expect(result.confidenceLevel).toBe(0.85);
    expect(mockDemandForecastRepo.save).toHaveBeenCalled();
  });

  it("should apply trend multiplier correctly", async () => {
    mockCalculateSalesVelocity.execute.mockResolvedValue({
      sku: "SKU-123",
      locationId: "loc-1",
      currentStock: 100,
      averageDailySales7d: 10,
      averageDailySales30d: 10,
      averageDailySales90d: 10,
      daysOfCover: 10,
      runOutDate: new Date(),
    });

    mockDispatchRecordRepo.fetchHistory.mockResolvedValue([]);

    const result = await useCase.execute({
      sku: "SKU-123",
      locationId: "loc-1",
      forecastDays: 10,
      trendMultiplier: 1.5,
    });

    expect(result.forecastedQuantity).toBe(150); // 10 * 10 * 1.5 * 1.0
  });

  it("should calculate and apply seasonal multiplier based on history", async () => {
    mockCalculateSalesVelocity.execute.mockResolvedValue({
      sku: "SKU-123",
      locationId: "loc-1",
      currentStock: 100,
      averageDailySales7d: 5,
      averageDailySales30d: 5,
      averageDailySales90d: 5,
      daysOfCover: 20,
      runOutDate: new Date(),
    });

    // History: 5 (May - target month), 4, 3, 2, 1 (other months) -> Total 15 in 5 active months -> Avg 3.
    // Target month sales = 5 -> index = 5 / 3 = 1.666...
    mockDispatchRecordRepo.fetchHistory.mockResolvedValue([
      new DispatchRecord("1", "SKU-123", "loc-1", 5, new Date("2022-05-10T12:00:00.000Z")), // Month 4
      new DispatchRecord("2", "SKU-123", "loc-1", 4, new Date("2022-06-10T12:00:00.000Z")), // Month 5
      new DispatchRecord("3", "SKU-123", "loc-1", 3, new Date("2022-07-10T12:00:00.000Z")), // Month 6
      new DispatchRecord("4", "SKU-123", "loc-1", 2, new Date("2022-08-10T12:00:00.000Z")), // Month 7
      new DispatchRecord("5", "SKU-123", "loc-1", 1, new Date("2022-09-10T12:00:00.000Z")), // Month 8
    ]);

    const result = await useCase.execute({
      sku: "SKU-123",
      locationId: "loc-1",
      forecastDays: 10,
    });

    // Base = 5 * 10 = 50. Seasonal = 5/3 = 1.666... -> 50 * 1.666... = 83.33... -> Ceil = 84
    expect(result.forecastedQuantity).toBe(84);
  });

  it("should cap seasonal multiplier at boundaries", async () => {
    mockCalculateSalesVelocity.execute.mockResolvedValue({
      sku: "SKU-123",
      locationId: "loc-1",
      currentStock: 100,
      averageDailySales7d: 5,
      averageDailySales30d: 10,
      averageDailySales90d: 5,
      daysOfCover: 10,
      runOutDate: new Date(),
    });

    // Cap at 3.0
    // Active months = 5. Total = 190. Avg = 38.
    // Target month = 150. 150 / 38 = 3.94 -> Capped at 3.0
    mockDispatchRecordRepo.fetchHistory.mockResolvedValue([
      new DispatchRecord("1", "SKU-123", "loc-1", 150, new Date("2022-05-10T12:00:00.000Z")), // Month 4
      new DispatchRecord("2", "SKU-123", "loc-1", 10, new Date("2022-06-10T12:00:00.000Z")), // Month 5
      new DispatchRecord("3", "SKU-123", "loc-1", 10, new Date("2022-07-10T12:00:00.000Z")), // Month 6
      new DispatchRecord("4", "SKU-123", "loc-1", 10, new Date("2022-08-10T12:00:00.000Z")), // Month 7
      new DispatchRecord("5", "SKU-123", "loc-1", 10, new Date("2022-09-10T12:00:00.000Z")), // Month 8
    ]);

    const result = await useCase.execute({
      sku: "SKU-123",
      locationId: "loc-1",
      forecastDays: 10,
    });

    // Base = 10 * 10 = 100. Seasonal = 3.0 -> 300.
    expect(result.forecastedQuantity).toBe(300);
  });

  it("should set low confidence if no recent sales", async () => {
     mockCalculateSalesVelocity.execute.mockResolvedValue({
      sku: "SKU-123",
      locationId: "loc-1",
      currentStock: 100,
      averageDailySales7d: 0,
      averageDailySales30d: 0,
      averageDailySales90d: 0,
      daysOfCover: Infinity,
      runOutDate: null,
    });

    mockDispatchRecordRepo.fetchHistory.mockResolvedValue([]);

    const result = await useCase.execute({
      sku: "SKU-123",
      locationId: "loc-1",
      forecastDays: 10,
    });

    expect(result.confidenceLevel).toBe(0.50);
  });
});
