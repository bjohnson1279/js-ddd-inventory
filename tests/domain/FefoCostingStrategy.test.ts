import { FefoCostingStrategy } from "../../src/domain/accounting/strategies/FefoCostingStrategy";
import { InventoryCostLayer } from "../../src/domain/accounting/entities/InventoryCostLayer";
import { CostingStrategyRegistry } from "../../src/domain/accounting/strategies/CostingStrategyRegistry";
import { CostingMethod } from "../../src/domain/accounting/enums/CostingMethod";

describe("FefoCostingStrategy", () => {
  let strategy: FefoCostingStrategy;

  beforeEach(() => {
    strategy = new FefoCostingStrategy();
  });

  it("should retrieve FEFO strategy from registry", () => {
    const regStrategy = CostingStrategyRegistry.get(CostingMethod.FEFO);
    expect(regStrategy).toBeInstanceOf(FefoCostingStrategy);
  });

  it("should consume layers based on earliest expiration date first", () => {
    const now = new Date();
    const expEarlier = new Date(now.getTime() + 100000);
    const expLater = new Date(now.getTime() + 500000);

    const layer1 = new InventoryCostLayer(
      "layer-1", "var-1", "tenant-1", 10, 1000, new Date("2026-01-01"), "po-1", "loc-1", "lot-A", expLater
    );
    const layer2 = new InventoryCostLayer(
      "layer-2", "var-1", "tenant-1", 10, 500, new Date("2026-01-02"), "po-2", "loc-1", "lot-B", expEarlier
    );

    // Consume 15 units. Layer 2 expires earlier (expEarlier), so its 10 units @ 500 should be consumed first,
    // followed by 5 units @ 1000 from Layer 1.
    // Total cost = 10 * 500 + 5 * 1000 = 5000 + 5000 = 10000.
    const result = strategy.consumeLayers([layer1, layer2], 15, "var-1");
    expect(result.totalCostCents).toBe(10000);
    expect(layer2.remainingQuantity).toBe(0);
    expect(layer1.remainingQuantity).toBe(5);
  });
});
