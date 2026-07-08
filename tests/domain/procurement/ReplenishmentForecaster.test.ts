import { DemandVelocityCalculator, ReorderPointForecaster } from "../../../src/domain/procurement/services/ReplenishmentForecaster";
import { InMemoryDispatchRecordRepository } from "../../../src/infrastructure/database/InMemoryDispatchRecordRepository";
import { InMemoryProductRepository } from "../../../src/infrastructure/database/InMemoryProductRepository";
import { InMemoryPurchaseOrderRepository } from "../../../src/infrastructure/database/InMemoryPurchaseOrderRepository";
import { Product } from "../../../src/domain/product/aggregates/Product";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { VariantAttribute } from "../../../src/domain/product/valueObjects/VariantAttribute";
import { DispatchRecord } from "../../../src/domain/repositories/IDispatchRecordRepository";
import { PurchaseOrder } from "../../../src/domain/procurement/aggregates/PurchaseOrder";
import { PurchaseOrderItem } from "../../../src/domain/procurement/aggregates/PurchaseOrderItem";
import { PurchaseOrderStatus } from "../../../src/domain/procurement/enums/PurchaseOrderStatus";

describe("ReplenishmentForecaster (Express)", () => {
  let dispatchRepo: InMemoryDispatchRecordRepository;
  let productRepo: InMemoryProductRepository;
  let poRepo: InMemoryPurchaseOrderRepository;
  let velocityCalculator: DemandVelocityCalculator;
  let forecaster: ReorderPointForecaster;

  const tenantId = "tenant-test";
  const locationId = "loc-test";
  const skuStr = "TEST-SKU";

  beforeEach(() => {
    dispatchRepo = new InMemoryDispatchRecordRepository();
    productRepo = new InMemoryProductRepository();
    poRepo = new InMemoryPurchaseOrderRepository();
    velocityCalculator = new DemandVelocityCalculator(dispatchRepo, productRepo);
    forecaster = new ReorderPointForecaster(velocityCalculator, productRepo, poRepo);
  });

  describe("DemandVelocityCalculator", () => {
    it("should return 0 stats if product is not found", async () => {
      const stats = await velocityCalculator.calculateDailySalesStats("NON-EXISTENT", locationId, 30);
      expect(stats.average).toBe(0);
      expect(stats.stdDev).toBe(0);
    });

    it("should calculate daily sales average and standard deviation correctly", async () => {
      const product = new Product("prod-1", "Test Product");
      product.addVariant(SKU.create(skuStr), [new VariantAttribute("size", "M")]);
      await productRepo.save(product);

      const baseTime = new Date().getTime();

      // Seed 60 units dispatched today
      for (let i = 0; i < 30; i++) {
        await dispatchRepo.save(new DispatchRecord(
          `rec-${i}`,
          skuStr,
          locationId,
          2, // 2 units each
          new Date(baseTime)
        ));
      }

      const stats = await velocityCalculator.calculateDailySalesStats(skuStr, locationId, 30);
      expect(stats.average).toBe(2); // 60 total / 30 days = 2 units per day
      // 1 day has 60 units. 29 days have 0 units.
      // variance = ( (60 - 2)^2 + 29 * (0 - 2)^2 ) / 30 = ( 3364 + 116 ) / 30 = 3480 / 30 = 116.
      // stdDev = sqrt(116) = 10.77
      expect(stats.stdDev).toBeCloseTo(10.77, 2);
    });
  });

  describe("ReorderPointForecaster", () => {
    it("should forecast reorder point with lead-time variance from received POs", async () => {
      const product = new Product("prod-1", "Test Product");
      const variant = product.addVariant(SKU.create(skuStr), [new VariantAttribute("size", "M")]);
      await productRepo.save(product);

      const baseTime = new Date().getTime();

      // Seed 60 units dispatched today
      for (let i = 0; i < 30; i++) {
        await dispatchRepo.save(new DispatchRecord(
          `rec-${i}`,
          skuStr,
          locationId,
          2, // 2 units each
          new Date(baseTime)
        ));
      }

      // Seed historical purchase orders for lead time calculation
      // PO 1: took 4 days
      const po1 = new PurchaseOrder(
        "po-1",
        "PO-100",
        "supplier-1",
        tenantId,
        locationId,
        PurchaseOrderStatus.Received,
        [new PurchaseOrderItem("item-1", variant.id, 100, 10, 100)],
        new Date(baseTime),
        new Date(baseTime + (4 * 24 * 60 * 60 * 1000))
      );
      await poRepo.save(po1);

      // PO 2: took 6 days
      const po2 = new PurchaseOrder(
        "po-2",
        "PO-200",
        "supplier-1",
        tenantId,
        locationId,
        PurchaseOrderStatus.Received,
        [new PurchaseOrderItem("item-2", variant.id, 100, 10, 100)],
        new Date(baseTime),
        new Date(baseTime + (6 * 24 * 60 * 60 * 1000))
      );
      await poRepo.save(po2);

      // leadTimes = [4, 6] -> average = 5 days, variance = 1, stdDev = 1.
      // averageDailySales = 2, stdDevDailySales = 10.77.
      // term1 = 5 * 116 = 580.
      // term2 = 4 * 1 = 4.
      // safetyStock = 1.65 * sqrt(584) = 1.65 * 24.166 = 39.87.
      // ROP = 2 * 5 + 39.87 = 49.87 -> ceil -> 50.
      const rop = await forecaster.forecastReorderPoint(skuStr, locationId, 5, 5, 30, tenantId);
      expect(rop).toBe(50);
    });
  });
});
