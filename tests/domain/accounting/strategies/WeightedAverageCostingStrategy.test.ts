import { WeightedAverageCostingStrategy } from "../../../../src/domain/accounting/strategies/WeightedAverageCostingStrategy";
import { InventoryCostLayer } from "../../../../src/domain/accounting/entities/InventoryCostLayer";
import { InsufficientInventoryException } from "../../../../src/domain/exceptions/InsufficientInventoryException";

describe("WeightedAverageCostingStrategy", () => {
  let strategy: WeightedAverageCostingStrategy;

  beforeEach(() => {
    strategy = new WeightedAverageCostingStrategy();
  });

  const createLayer = (
    quantity: number,
    unitCostCents: number,
    receivedAt: Date
  ): InventoryCostLayer => {
    return new InventoryCostLayer(
      "test-id",
      "test-variant",
      "tenant-1",
      quantity,
      unitCostCents,
      receivedAt,
      "po-1"
    );
  };

  describe("calculateCost", () => {
    it("should calculate cost from a single layer", () => {
      const layers = [
        createLayer(10, 1000, new Date("2023-01-01")),
      ];
      const result = strategy.calculateCost(layers, 5, "test-variant");

      expect(result.units).toBe(5);
      expect(result.totalCostCents).toBe(5000);
      expect(layers[0].remainingQuantity).toBe(10); // Not consumed
    });

    it("should calculate cost spanning multiple layers, rounding appropriately", () => {
      const layers = [
        createLayer(10, 2000, new Date("2023-01-02")), // Total 20000
        createLayer(5, 1000, new Date("2023-01-01")),  // Total 5000
      ];

      // Total units: 15
      // Total value: 25000
      // Avg unit cost: 25000 / 15 = 1666.666...
      // Requesting 10 units: 10 * 1666.666... = 16666.666... => Math.round(16667)

      const result = strategy.calculateCost(layers, 10, "test-variant");

      expect(result.units).toBe(10);
      expect(result.totalCostCents).toBe(16667);

      // Layers remain unconsumed
      expect(layers[0].remainingQuantity).toBe(10);
      expect(layers[1].remainingQuantity).toBe(5);
    });

    it("should throw InsufficientInventoryException if requested quantity exceeds available", () => {
      const layers = [
        createLayer(5, 1000, new Date("2023-01-01")),
      ];

      expect(() => {
        strategy.calculateCost(layers, 10, "test-variant");
      }).toThrow(InsufficientInventoryException);
    });
  });

  describe("consumeLayers", () => {
    it("should consume inventory and calculate cost from a single layer", () => {
      const layers = [
        createLayer(10, 1000, new Date("2023-01-01")),
      ];
      const result = strategy.consumeLayers(layers, 5, "test-variant");

      expect(result.units).toBe(5);
      expect(result.totalCostCents).toBe(5000);
      expect(layers[0].remainingQuantity).toBe(5); // Consumed
    });

    it("should consume inventory spanning multiple layers in FIFO order while calculating weighted average cost", () => {
      const layers = [
        createLayer(10, 2000, new Date("2023-01-02")), // Newer (Cost: 2000)
        createLayer(5, 1000, new Date("2023-01-01")),  // Older (Cost: 1000)
      ];

      const result = strategy.consumeLayers(layers, 10, "test-variant");

      expect(result.units).toBe(10);
      expect(result.totalCostCents).toBe(16667); // Same average calculation as above

      // FIFO consumption:
      // Older layer should be fully consumed (5 units)
      expect(layers[1].remainingQuantity).toBe(0);
      // Newer layer should have 5 units remaining (10 - 5 consumed)
      expect(layers[0].remainingQuantity).toBe(5);
    });

    it("should stop consuming layers early when requested quantity is fully met", () => {
      const layers = [
        createLayer(5, 1000, new Date("2023-01-01")), // Exactly fulfills request (Older)
        createLayer(10, 2000, new Date("2023-01-02")), // Should not be consumed (Newer)
      ];

      const result = strategy.consumeLayers(layers, 5, "test-variant");

      expect(result.units).toBe(5);
      expect(result.totalCostCents).toBe(8333); // 5 units * (25000 total cents / 15 total units) = 8333.33 => 8333
      expect(layers[0].remainingQuantity).toBe(0); // Fully consumed
      expect(layers[1].remainingQuantity).toBe(10); // Not processed/consumed
    });

    it("should throw InsufficientInventoryException if requested quantity exceeds available", () => {
      const layers = [
        createLayer(5, 1000, new Date("2023-01-01")),
      ];

      expect(() => {
        strategy.consumeLayers(layers, 10, "test-variant");
      }).toThrow(InsufficientInventoryException);
    });
  });
});
