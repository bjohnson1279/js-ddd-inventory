import { FefoCostingStrategy } from "../../src/domain/accounting/strategies/FefoCostingStrategy";
import { InventoryCostLayer } from "../../src/domain/accounting/entities/InventoryCostLayer";
import { CostingStrategyRegistry } from "../../src/domain/accounting/strategies/CostingStrategyRegistry";
import { CostingMethod } from "../../src/domain/accounting/enums/CostingMethod";
import { InsufficientInventoryException } from "../../src/domain/exceptions/InsufficientInventoryException";

describe("FefoCostingStrategy", () => {
  let strategy: FefoCostingStrategy;

  beforeEach(() => {
    strategy = new FefoCostingStrategy();
  });

  const createLayer = (
    id: string,
    quantity: number,
    unitCostCents: number,
    receivedAt: Date,
    expirationDate?: Date
  ): InventoryCostLayer => {
    return new InventoryCostLayer(
      id,
      "var-1",
      "tenant-1",
      quantity,
      unitCostCents,
      receivedAt,
      "po-1",
      "loc-1",
      "lot-1",
      expirationDate
    );
  };

  it("should retrieve FEFO strategy from registry", () => {
    const regStrategy = CostingStrategyRegistry.get(CostingMethod.FEFO);
    expect(regStrategy).toBeInstanceOf(FefoCostingStrategy);
  });

  describe("calculateCost", () => {
    it("should calculate cost from a single layer without mutating remaining quantity", () => {
      const now = new Date();
      const layer = createLayer("layer-1", 10, 1000, now, new Date(now.getTime() + 100000));

      const result = strategy.calculateCost([layer], 5, "var-1");

      expect(result.units).toBe(5);
      expect(result.totalCostCents).toBe(5000);
      expect(layer.remainingQuantity).toBe(10);
    });

    it("should sort layers by earliest expiration date first", () => {
      const now = new Date();
      const expEarlier = new Date(now.getTime() + 100000);
      const expLater = new Date(now.getTime() + 500000);

      const layerLaterExp = createLayer("layer-1", 10, 1000, new Date("2026-01-01"), expLater);
      const layerEarlierExp = createLayer("layer-2", 10, 500, new Date("2026-01-02"), expEarlier);

      const result = strategy.calculateCost([layerLaterExp, layerEarlierExp], 15, "var-1");

      expect(result.units).toBe(15);
      expect(result.totalCostCents).toBe(10000); // 10 * 500 + 5 * 1000
      expect(layerLaterExp.remainingQuantity).toBe(10);
      expect(layerEarlierExp.remainingQuantity).toBe(10);
    });

    it("should break ties for identical expiration dates using FIFO receivedAt timestamp", () => {
      const exp = new Date("2026-12-31");
      const olderReceived = new Date("2026-01-01");
      const newerReceived = new Date("2026-02-01");

      const layerNewer = createLayer("layer-newer", 10, 2000, newerReceived, exp);
      const layerOlder = createLayer("layer-older", 10, 1000, olderReceived, exp);

      // Should prioritize olderReceived first
      const result = strategy.calculateCost([layerNewer, layerOlder], 15, "var-1");

      expect(result.units).toBe(15);
      expect(result.totalCostCents).toBe(20000); // 10 * 1000 + 5 * 2000
    });

    it("should treat layers without expiration dates as expiring last (Infinity)", () => {
      const now = new Date();
      const exp = new Date(now.getTime() + 100000);

      const layerNoExp = createLayer("layer-no-exp", 10, 3000, new Date("2026-01-01"), undefined);
      const layerWithExp = createLayer("layer-with-exp", 10, 1000, new Date("2026-02-01"), exp);

      const result = strategy.calculateCost([layerNoExp, layerWithExp], 15, "var-1");

      expect(result.units).toBe(15);
      expect(result.totalCostCents).toBe(25000); // 10 * 1000 + 5 * 3000
    });

    it("should sort layers with both undefined expiration dates by FIFO receivedAt timestamp", () => {
      const olderReceived = new Date("2026-01-01");
      const newerReceived = new Date("2026-02-01");

      const layerOlderNoExp = createLayer("layer-older-no-exp", 10, 1000, olderReceived, undefined);
      const layerNewerNoExp = createLayer("layer-newer-no-exp", 10, 2000, newerReceived, undefined);

      const result = strategy.calculateCost([layerNewerNoExp, layerOlderNoExp], 15, "var-1");

      expect(result.units).toBe(15);
      expect(result.totalCostCents).toBe(20000); // 10 * 1000 + 5 * 2000
    });

    it("should stop processing once remaining requested quantity reaches zero", () => {
      const now = new Date();
      const exp1 = new Date(now.getTime() + 100000);
      const exp2 = new Date(now.getTime() + 200000);

      const layer1 = createLayer("layer-1", 10, 1000, now, exp1);
      const layer2 = createLayer("layer-2", 10, 2000, now, exp2);

      const result = strategy.calculateCost([layer1, layer2], 10, "var-1");

      expect(result.units).toBe(10);
      expect(result.totalCostCents).toBe(10000);
    });

    it("should return zero cost when requesting 0 quantity", () => {
      const now = new Date();
      const layer = createLayer("layer-1", 10, 1000, now, new Date(now.getTime() + 100000));

      const result = strategy.calculateCost([layer], 0, "var-1");

      expect(result.units).toBe(0);
      expect(result.totalCostCents).toBe(0);
    });

    it("should throw InsufficientInventoryException when requested quantity exceeds available quantity", () => {
      const now = new Date();
      const layer1 = createLayer("layer-1", 5, 1000, now, new Date(now.getTime() + 100000));
      const layer2 = createLayer("layer-2", 5, 2000, now, new Date(now.getTime() + 200000));

      expect(() => {
        strategy.calculateCost([layer1, layer2], 15, "var-1");
      }).toThrow(InsufficientInventoryException);
    });

    it("should throw InsufficientInventoryException when layers array is empty and quantity > 0", () => {
      expect(() => {
        strategy.calculateCost([], 5, "var-1");
      }).toThrow(InsufficientInventoryException);
    });
  });

  describe("consumeLayers", () => {
    it("should consume layers based on earliest expiration date first and mutate remainingQuantity", () => {
      const now = new Date();
      const expEarlier = new Date(now.getTime() + 100000);
      const expLater = new Date(now.getTime() + 500000);

      const layer1 = createLayer("layer-1", 10, 1000, new Date("2026-01-01"), expLater);
      const layer2 = createLayer("layer-2", 10, 500, new Date("2026-01-02"), expEarlier);

      const result = strategy.consumeLayers([layer1, layer2], 15, "var-1");

      expect(result.units).toBe(15);
      expect(result.totalCostCents).toBe(10000);
      expect(layer2.remainingQuantity).toBe(0);
      expect(layer1.remainingQuantity).toBe(5);
    });

    it("should break ties for identical expiration dates using FIFO receivedAt timestamp when consuming", () => {
      const exp = new Date("2026-12-31");
      const olderReceived = new Date("2026-01-01");
      const newerReceived = new Date("2026-02-01");

      const layerNewer = createLayer("layer-newer", 10, 2000, newerReceived, exp);
      const layerOlder = createLayer("layer-older", 10, 1000, olderReceived, exp);

      const result = strategy.consumeLayers([layerNewer, layerOlder], 15, "var-1");

      expect(result.units).toBe(15);
      expect(result.totalCostCents).toBe(20000);
      expect(layerOlder.remainingQuantity).toBe(0);
      expect(layerNewer.remainingQuantity).toBe(5);
    });

    it("should consume layers without expiration date last", () => {
      const now = new Date();
      const exp = new Date(now.getTime() + 100000);

      const layerNoExp = createLayer("layer-no-exp", 10, 3000, new Date("2026-01-01"), undefined);
      const layerWithExp = createLayer("layer-with-exp", 10, 1000, new Date("2026-02-01"), exp);

      const result = strategy.consumeLayers([layerNoExp, layerWithExp], 15, "var-1");

      expect(result.units).toBe(15);
      expect(result.totalCostCents).toBe(25000);
      expect(layerWithExp.remainingQuantity).toBe(0);
      expect(layerNoExp.remainingQuantity).toBe(5);
    });

    it("should sort layers with both undefined expiration dates by FIFO receivedAt timestamp when consuming", () => {
      const olderReceived = new Date("2026-01-01");
      const newerReceived = new Date("2026-02-01");

      const layerOlderNoExp = createLayer("layer-older-no-exp", 10, 1000, olderReceived, undefined);
      const layerNewerNoExp = createLayer("layer-newer-no-exp", 10, 2000, newerReceived, undefined);

      const result = strategy.consumeLayers([layerNewerNoExp, layerOlderNoExp], 15, "var-1");

      expect(result.units).toBe(15);
      expect(result.totalCostCents).toBe(20000);
      expect(layerOlderNoExp.remainingQuantity).toBe(0);
      expect(layerNewerNoExp.remainingQuantity).toBe(5);
    });

    it("should stop consuming once requested quantity is fully fulfilled", () => {
      const now = new Date();
      const exp1 = new Date(now.getTime() + 100000);
      const exp2 = new Date(now.getTime() + 200000);

      const layer1 = createLayer("layer-1", 10, 1000, now, exp1);
      const layer2 = createLayer("layer-2", 10, 2000, now, exp2);

      const result = strategy.consumeLayers([layer1, layer2], 10, "var-1");

      expect(result.units).toBe(10);
      expect(result.totalCostCents).toBe(10000);
      expect(layer1.remainingQuantity).toBe(0);
      expect(layer2.remainingQuantity).toBe(10);
    });

    it("should return zero cost when consuming 0 quantity", () => {
      const now = new Date();
      const layer = createLayer("layer-1", 10, 1000, now, new Date(now.getTime() + 100000));

      const result = strategy.consumeLayers([layer], 0, "var-1");

      expect(result.units).toBe(0);
      expect(result.totalCostCents).toBe(0);
      expect(layer.remainingQuantity).toBe(10);
    });

    it("should throw InsufficientInventoryException when requested quantity exceeds available quantity", () => {
      const now = new Date();
      const layer1 = createLayer("layer-1", 5, 1000, now, new Date(now.getTime() + 100000));
      const layer2 = createLayer("layer-2", 5, 2000, now, new Date(now.getTime() + 200000));

      expect(() => {
        strategy.consumeLayers([layer1, layer2], 15, "var-1");
      }).toThrow(InsufficientInventoryException);
    });

    it("should throw InsufficientInventoryException when layers array is empty and quantity > 0", () => {
      expect(() => {
        strategy.consumeLayers([], 5, "var-1");
      }).toThrow(InsufficientInventoryException);
    });
  });
});
