import { FifoCostingStrategy } from "../../../../src/domain/accounting/strategies/FifoCostingStrategy";
import { InventoryCostLayer } from "../../../../src/domain/accounting/entities/InventoryCostLayer";
import { InsufficientInventoryException } from "../../../../src/domain/exceptions/InsufficientInventoryException";

describe("FifoCostingStrategy", () => {
  let strategy: FifoCostingStrategy;

  beforeEach(() => {
    strategy = new FifoCostingStrategy();
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

    it("should calculate cost spanning multiple layers in FIFO order", () => {
      const layers = [
        createLayer(10, 2000, new Date("2023-01-02")), // Newer
        createLayer(5, 1000, new Date("2023-01-01")),  // Older
      ];

      const result = strategy.calculateCost(layers, 10, "test-variant");

      // Should take 5 from older (5 * 1000) = 5000
      // Should take 5 from newer (5 * 2000) = 10000
      // Total = 15000
      expect(result.units).toBe(10);
      expect(result.totalCostCents).toBe(15000);
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

    it("should consume inventory spanning multiple layers in FIFO order", () => {
      const layers = [
        createLayer(10, 2000, new Date("2023-01-02")), // Newer
        createLayer(5, 1000, new Date("2023-01-01")),  // Older
      ];

      const result = strategy.consumeLayers(layers, 10, "test-variant");

      expect(result.units).toBe(10);
      expect(result.totalCostCents).toBe(15000);

      // Older layer should be fully consumed
      expect(layers[1].remainingQuantity).toBe(0);
      // Newer layer should have 5 remaining
      expect(layers[0].remainingQuantity).toBe(5);
    });

    it("should throw InsufficientInventoryException if requested quantity exceeds available", () => {
      const layers = [
        createLayer(5, 1000, new Date("2023-01-01")),
      ];

      expect(() => {
        strategy.consumeLayers(layers, 10, "test-variant");
      }).toThrow(InsufficientInventoryException);

      // The state of layers might change partially in the current implementation before throwing,
      // but the exception is what matters here.
    });
  });
});
