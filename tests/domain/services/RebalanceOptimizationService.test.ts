jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    inventoryModel: {
      findMany: jest.fn(),
    },
    demandForecastModel: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from "../../../src/infrastructure/database/prisma";
import { RebalanceOptimizationService } from "../../../src/domain/services/RebalanceOptimizationService";
import { Logger } from "../../../src/infrastructure/logging/logger";

describe("RebalanceOptimizationService Unit Tests", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it("should initialize sidecarUrl with default fallback when PYTHON_SIDECAR_URL is not set", async () => {
    delete process.env.PYTHON_SIDECAR_URL;
    const service = new RebalanceOptimizationService();

    (prisma.inventoryModel.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.demandForecastModel.findMany as jest.Mock).mockResolvedValue([]);

    const mockResponse = { transfers: [], costSavings: 0 };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      send: jest.fn().mockResolvedValue(mockResponse),
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await service.optimize("tenant-default");

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:5005/rebalance-optimize",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouses: [
            { id: "WH1", name: "Main Warehouse", region: "East" },
            { id: "WH2", name: "Secondary Warehouse", region: "West" }
          ],
          stock_levels: [],
          demand_forecasts: [],
          lead_times: [
            { source_warehouse_id: "WH1", dest_warehouse_id: "WH2", transit_days: 3 },
            { source_warehouse_id: "WH2", dest_warehouse_id: "WH1", transit_days: 3 }
          ],
          shipping_costs: [
            { source_warehouse_id: "WH1", dest_warehouse_id: "WH2", cost_per_unit: 1.5 },
            { source_warehouse_id: "WH2", dest_warehouse_id: "WH1", cost_per_unit: 1.5 }
          ],
          constraints: {
            max_transfers_per_run: 20,
            min_transfer_quantity: 5,
            min_days_of_cover_target: 14.0
          }
        }),
      })
    );
  });

  it("should query inventory and demands and map payload properly when calling sidecar with custom URL", async () => {
    process.env.PYTHON_SIDECAR_URL = "http://custom-sidecar.internal:9000";
    const service = new RebalanceOptimizationService();

    (prisma.inventoryModel.findMany as jest.Mock).mockResolvedValue([
      {
        sku: "SKU-EAST-1",
        locationId: "WH1-BIN-01",
        quantity: 100,
        allocated: 20,
        inTransit: 5,
      },
      {
        sku: "SKU-WEST-1",
        locationId: "WH2-BIN-09",
        quantity: 50,
        allocated: 10,
        inTransit: 0,
      },
    ]);

    (prisma.demandForecastModel.findMany as jest.Mock).mockResolvedValue([
      {
        sku: "SKU-EAST-1",
        locationId: "WH1-ZONE",
        forecastedQuantity: 90,
      },
      {
        sku: "SKU-WEST-1",
        locationId: "WH2-ZONE",
        forecastedQuantity: 60,
      },
    ]);

    const mockOutput = {
      transfers: [
        {
          sku: "SKU-EAST-1",
          from: "WH1",
          to: "WH2",
          quantity: 15,
        },
      ],
      projected_cost: 22.5,
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      send: jest.fn().mockResolvedValue(mockOutput),
      json: jest.fn().mockResolvedValue(mockOutput),
    });

    const result = await service.optimize("tenant-123");

    expect(prisma.inventoryModel.findMany).toHaveBeenCalledWith({
      take: 500,
    });

    expect(prisma.demandForecastModel.findMany).toHaveBeenCalledWith({
      take: 500,
      orderBy: { createdAt: "desc" },
    });

    expect(result).toEqual(mockOutput);

    const expectedPayload = {
      warehouses: [
        { id: "WH1", name: "Main Warehouse", region: "East" },
        { id: "WH2", name: "Secondary Warehouse", region: "West" },
      ],
      stock_levels: [
        {
          sku: "SKU-EAST-1",
          warehouse_id: "WH1",
          on_hand: 100,
          allocated: 20,
          in_transit: 5,
          safety_stock: 10,
        },
        {
          sku: "SKU-WEST-1",
          warehouse_id: "WH2",
          on_hand: 50,
          allocated: 10,
          in_transit: 0,
          safety_stock: 10,
        },
      ],
      demand_forecasts: [
        {
          sku: "SKU-EAST-1",
          warehouse_id: "WH1",
          daily_velocity_7d: 3, // 90 / 30
          daily_velocity_30d: 3,
          daily_velocity_90d: 3,
        },
        {
          sku: "SKU-WEST-1",
          warehouse_id: "WH2",
          daily_velocity_7d: 2, // 60 / 30
          daily_velocity_30d: 2,
          daily_velocity_90d: 2,
        },
      ],
      lead_times: [
        { source_warehouse_id: "WH1", dest_warehouse_id: "WH2", transit_days: 3 },
        { source_warehouse_id: "WH2", dest_warehouse_id: "WH1", transit_days: 3 },
      ],
      shipping_costs: [
        { source_warehouse_id: "WH1", dest_warehouse_id: "WH2", cost_per_unit: 1.5 },
        { source_warehouse_id: "WH2", dest_warehouse_id: "WH1", cost_per_unit: 1.5 },
      ],
      constraints: {
        max_transfers_per_run: 20,
        min_transfer_quantity: 5,
        min_days_of_cover_target: 14.0,
      },
    };

    expect(global.fetch).toHaveBeenCalledWith(
      "http://custom-sidecar.internal:9000/rebalance-optimize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expectedPayload),
      }
    );
  });

  it("should log error and throw 'Failed to optimize rebalancing' when sidecar returns non-ok HTTP status", async () => {
    const service = new RebalanceOptimizationService();

    (prisma.inventoryModel.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.demandForecastModel.findMany as jest.Mock).mockResolvedValue([]);

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const loggerErrorSpy = jest.spyOn(Logger, "error").mockImplementation();

    await expect(service.optimize("tenant-err")).rejects.toThrow("Failed to optimize rebalancing");

    expect(loggerErrorSpy).toHaveBeenCalledWith({
      context: "RebalanceOptimizationService",
      message: "HTTP error! status: 500",
    });

    loggerErrorSpy.mockRestore();
  });

  it("should log error and throw 'Failed to optimize rebalancing' when network fetch fails", async () => {
    const service = new RebalanceOptimizationService();

    (prisma.inventoryModel.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.demandForecastModel.findMany as jest.Mock).mockResolvedValue([]);

    global.fetch = jest.fn().mockRejectedValue(new Error("Network timeout"));

    const loggerErrorSpy = jest.spyOn(Logger, "error").mockImplementation();

    await expect(service.optimize("tenant-net-err")).rejects.toThrow("Failed to optimize rebalancing");

    expect(loggerErrorSpy).toHaveBeenCalledWith({
      context: "RebalanceOptimizationService",
      message: "Network timeout",
    });

    loggerErrorSpy.mockRestore();
  });

  it("should log error and throw 'Failed to optimize rebalancing' when database query fails", async () => {
    const service = new RebalanceOptimizationService();

    (prisma.inventoryModel.findMany as jest.Mock).mockRejectedValue(
      new Error("Database connection error")
    );

    const loggerErrorSpy = jest.spyOn(Logger, "error").mockImplementation();

    await expect(service.optimize("tenant-db-fail")).rejects.toThrow("Failed to optimize rebalancing");

    expect(loggerErrorSpy).toHaveBeenCalledWith({
      context: "RebalanceOptimizationService",
      message: "Database connection error",
    });

    loggerErrorSpy.mockRestore();
  });
});
