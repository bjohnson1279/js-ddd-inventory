process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "dummy_test_secret";
process.env.SHOPIFY_API_SECRET = "dummy_test_secret";

import request from "supertest";
import { app, setupApp } from "../../../src/index";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { InMemoryReorderPolicyRepository } from "../../../src/infrastructure/database/InMemoryReorderPolicyRepository";
import { InMemoryDispatchRecordRepository } from "../../../src/infrastructure/database/InMemoryDispatchRecordRepository";
import { InMemoryDemandForecastRepository } from "../../../src/infrastructure/database/InMemoryDemandForecastRepository";
import { DispatchRecord } from "../../../src/domain/repositories/IDispatchRecordRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";

describe("Forecasting & Demand Planning HTTP API Endpoints", () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let policyRepo: InMemoryReorderPolicyRepository;
  let dispatchRecordRepo: InMemoryDispatchRecordRepository;
  let demandForecastRepo: InMemoryDemandForecastRepository;

  beforeEach(() => {
    inventoryRepo = new InMemoryInventoryRepository();
    policyRepo = new InMemoryReorderPolicyRepository();
    dispatchRecordRepo = new InMemoryDispatchRecordRepository();
    demandForecastRepo = new InMemoryDemandForecastRepository();

    setupApp(
      inventoryRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      policyRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      dispatchRecordRepo,
      demandForecastRepo
    );
  });

  it("should record dispatches, compute sales velocity/days of cover, and return demand planning report", async () => {
    // 1. Set up an inventory item with stock level 50
    const sku = "IPHONE-15";
    const locationId = "warehouse-south";
    const item = InventoryItem.create("item-1", SKU.create(sku), locationId, Quantity.create(50));
    await inventoryRepo.save(item);

    // 2. Add some historic dispatch records for this SKU & location
    // We want a non-zero 30-day sales velocity. Let's record:
    // 3 dispatches of size 10, total 30 units dispatched in the last 30 days.
    // 30 units / 30 days = 1.0 Average Daily Sales (ADS).
    const now = new Date();
    await dispatchRecordRepo.save(new DispatchRecord("1", sku, locationId, 10, new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)));
    await dispatchRecordRepo.save(new DispatchRecord("2", sku, locationId, 10, new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)));
    await dispatchRecordRepo.save(new DispatchRecord("3", sku, locationId, 10, new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)));

    // 3. Request demand planning report
    const reportRes = await request(app)
      .get(`/api/forecasting/report?locationId=${locationId}`);

    expect(reportRes.status).toBe(200);
    expect(reportRes.body.length).toBe(1);
    
    const reportItem = reportRes.body[0];
    expect(reportItem.sku).toBe(sku);
    expect(reportItem.locationId).toBe(locationId);
    expect(reportItem.currentStock).toBe(50);
    
    // 30 units in 30 days -> ADS 30d should be exactly 1.0 (30 / 30)
    expect(reportItem.averageDailySales30d).toBe(1.0);
    // Days of cover = currentStock (50) / ADS 30d (1.0) = 50 days
    expect(reportItem.daysOfCover).toBe(50);
    expect(reportItem.runOutDate).toBeDefined();

    // 4. Generate manual demand forecast via POST
    const forecastRes = await request(app)
      .post("/api/forecasting/forecast")
      .send({
        sku,
        locationId,
        forecastDays: 15,
        trendMultiplier: 1.2
      });

    expect(forecastRes.status).toBe(200);
    expect(forecastRes.body.message).toMatch(/success/i);
    expect(forecastRes.body.forecast).toBeDefined();
    
    const forecast = forecastRes.body.forecast;
    expect(forecast.sku).toBe(sku);
    expect(forecast.locationId).toBe(locationId);
    
    // Projected forecast quantity: Math.ceil(ADS (1.0) * forecastDays (15) * trendMultiplier (1.2)) = Math.ceil(18) = 18.
    expect(forecast.forecastedQuantity).toBe(18);
    expect(forecast.confidenceLevel).toBe(0.85);

    // 5. Request the report again. It should now reflect the active forecast
    const reportRes2 = await request(app)
      .get(`/api/forecasting/report?locationId=${locationId}`);

    expect(reportRes2.status).toBe(200);
    const reportItem2 = reportRes2.body[0];
    // forecastedDemand30d should now match the newly generated forecast (which is valid for the window since we did 15 days)
    // Wait, the forecast we created runs from now to now + 15 days.
    // In GetDemandPlanningReport, it checks if there is a forecast that:
    // f.periodEnd >= now && f.periodStart <= endWindow (where endWindow is now + 30 days)
    // The created forecast starts now (periodStart = now) and ends at now + 15 days (periodEnd = now + 15).
    // Both conditions match, so it will return f.forecastedQuantity = 18.
    expect(reportItem2.forecastedDemand30d).toBe(18);
    expect(reportItem2.confidenceLevel).toBe(0.85);
  });
});
