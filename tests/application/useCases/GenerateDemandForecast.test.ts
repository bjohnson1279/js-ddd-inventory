import { GenerateDemandForecast } from "../../../src/application/useCases/GenerateDemandForecast";
import { CalculateSalesVelocity } from "../../../src/application/useCases/CalculateSalesVelocity";
import { IDemandForecastRepository, DemandForecast } from "../../../src/domain/repositories/IDemandForecastRepository";
import { IDispatchRecordRepository, DispatchRecord } from "../../../src/domain/repositories/IDispatchRecordRepository";

describe("GenerateDemandForecast Use Case", () => {
  let mockDemandForecastRepo: jest.Mocked<IDemandForecastRepository>;
  let mockDispatchRepo: jest.Mocked<IDispatchRecordRepository>;
  let mockCalculateSalesVelocity: jest.Mocked<CalculateSalesVelocity>;
  let useCase: GenerateDemandForecast;

  beforeEach(() => {
    mockDemandForecastRepo = {
      save: jest.fn(),
      findForecast: jest.fn(),
      findAllForLocation: jest.fn(),
    } as any;

    mockDispatchRepo = {
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
      mockDispatchRepo
    );

    jest.useFakeTimers();
    jest.setSystemTime(new Date("2023-08-01T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should generate a forecast without history correctly", async () => {
    mockCalculateSalesVelocity.execute.mockResolvedValue({
      sku: "SKU-1",
      locationId: "LOC-1",
      currentStock: 100,
      averageDailySales7d: 10,
      averageDailySales30d: 10,
      averageDailySales90d: 10,
      daysOfCover: 10,
      runOutDate: new Date("2023-08-11T12:00:00.000Z")
    });
    mockDispatchRepo.fetchHistory.mockResolvedValue([]);

    const result = await useCase.execute({
      sku: "SKU-1",
      locationId: "LOC-1",
      forecastDays: 30,
    });

    expect(mockCalculateSalesVelocity.execute).toHaveBeenCalledWith("SKU-1", "LOC-1");
    expect(mockDemandForecastRepo.save).toHaveBeenCalled();
    expect(result.forecastedQuantity).toBe(300); // 10 * 30 * 1.0 * 1.0
    expect(result.confidenceLevel).toBe(0.85);
  });

  it("should handle zero velocity", async () => {
    mockCalculateSalesVelocity.execute.mockResolvedValue({
      sku: "SKU-1",
      locationId: "LOC-1",
      currentStock: 100,
      averageDailySales7d: 0,
      averageDailySales30d: 0,
      averageDailySales90d: 0,
      daysOfCover: Infinity,
      runOutDate: null
    });
    mockDispatchRepo.fetchHistory.mockResolvedValue([]);

    const result = await useCase.execute({
      sku: "SKU-1",
      locationId: "LOC-1",
      forecastDays: 30,
    });

    expect(result.forecastedQuantity).toBe(0);
    expect(result.confidenceLevel).toBe(0.50);
  });

  it("should calculate seasonal multipliers correctly and bound to max 3.0", async () => {
    mockCalculateSalesVelocity.execute.mockResolvedValue({
      sku: "SKU-1",
      locationId: "LOC-1",
      currentStock: 100,
      averageDailySales7d: 10,
      averageDailySales30d: 10,
      averageDailySales90d: 10,
      daysOfCover: 10,
      runOutDate: new Date()
    });

    const history: DispatchRecord[] = [
      new DispatchRecord("1", "SKU-1", "LOC-1", 100, new Date("2022-08-15T12:00:00.000Z")), // month 7
      new DispatchRecord("2", "SKU-1", "LOC-1", 10, new Date("2022-09-15T12:00:00.000Z")),  // month 8
      new DispatchRecord("3", "SKU-1", "LOC-1", 10, new Date("2022-10-15T12:00:00.000Z")),  // month 9
    ];

    mockDispatchRepo.fetchHistory.mockResolvedValue(history);

    const result = await useCase.execute({
      sku: "SKU-1",
      locationId: "LOC-1",
      forecastDays: 30,
      trendMultiplier: 1.2
    });

    expect(result.forecastedQuantity).toBe(900);
    expect(result.confidenceLevel).toBe(0.85);
  });

  it("should cap seasonal multipliers to 3.0", async () => {
    mockCalculateSalesVelocity.execute.mockResolvedValue({
      sku: "SKU-1",
      locationId: "LOC-1",
      currentStock: 100,
      averageDailySales7d: 10,
      averageDailySales30d: 10,
      averageDailySales90d: 10,
      daysOfCover: 10,
      runOutDate: new Date()
    });

    const history: DispatchRecord[] = [
      new DispatchRecord("1", "SKU-1", "LOC-1", 1000, new Date("2022-08-15T12:00:00.000Z")), // month 7
      new DispatchRecord("2", "SKU-1", "LOC-1", 10, new Date("2022-09-15T12:00:00.000Z")),  // month 8
      new DispatchRecord("3", "SKU-1", "LOC-1", 10, new Date("2022-10-15T12:00:00.000Z")),  // month 9
      new DispatchRecord("4", "SKU-1", "LOC-1", 10, new Date("2022-11-15T12:00:00.000Z")),  // month 10
    ];

    mockDispatchRepo.fetchHistory.mockResolvedValue(history);

    const result = await useCase.execute({
      sku: "SKU-1",
      locationId: "LOC-1",
      forecastDays: 30,
    });

    expect(result.forecastedQuantity).toBe(900);
  });

  it("should bound seasonal multipliers to min 0.3", async () => {
    mockCalculateSalesVelocity.execute.mockResolvedValue({
      sku: "SKU-1",
      locationId: "LOC-1",
      currentStock: 100,
      averageDailySales7d: 10,
      averageDailySales30d: 10,
      averageDailySales90d: 10,
      daysOfCover: 10,
      runOutDate: new Date()
    });

    const history: DispatchRecord[] = [
      new DispatchRecord("1", "SKU-1", "LOC-1", 10, new Date("2022-08-15T12:00:00.000Z")), // month 7
      new DispatchRecord("2", "SKU-1", "LOC-1", 500, new Date("2022-09-15T12:00:00.000Z")),  // month 8
      new DispatchRecord("3", "SKU-1", "LOC-1", 500, new Date("2022-10-15T12:00:00.000Z")),  // month 9
    ];

    mockDispatchRepo.fetchHistory.mockResolvedValue(history);

    const result = await useCase.execute({
      sku: "SKU-1",
      locationId: "LOC-1",
      forecastDays: 30,
    });

    // Base = 10 * 30 = 300
    // Avg = (10+500+500)/3 = 336.66
    // Target = 10
    // Mult = 10 / 336.66 = 0.029 -> caps to 0.3
    // Capped forecast = 300 * 0.3 = 90
    expect(result.forecastedQuantity).toBe(90);
  });
});
