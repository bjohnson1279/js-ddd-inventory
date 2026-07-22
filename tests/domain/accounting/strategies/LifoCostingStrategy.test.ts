import { LifoCostingStrategy } from "../../../../src/domain/accounting/strategies/LifoCostingStrategy";
import { InventoryCostLayer } from "../../../../src/domain/accounting/entities/InventoryCostLayer";
import { InsufficientInventoryException } from "../../../../src/domain/exceptions/InsufficientInventoryException";

describe("LifoCostingStrategy", () => {
  let strategy: LifoCostingStrategy;
  const variantId = "var-1";

  beforeEach(() => {
    strategy = new LifoCostingStrategy();
  });

  const createLayer = (
    id: string,
    quantity: number,
    unitCostCents: number,
    receivedAt: Date
  ) => {
    return new InventoryCostLayer(
      id,
      variantId,
      "tenant-1",
      quantity,
      unitCostCents,
      receivedAt,
      "po-1"
    );
  };

  describe("calculateCost", () => {
    it("should calculate cost using LIFO (Last-In-First-Out) order", () => {
      const layers = [
        createLayer("layer1", 10, 100, new Date("2023-01-01")), // Oldest
        createLayer("layer2", 5, 200, new Date("2023-01-03")),  // Newest
        createLayer("layer3", 8, 150, new Date("2023-01-02")),  // Middle
      ];

      // Request 10 items
      // Expect 5 from layer2 (5 * 200 = 1000)
      // Expect 5 from layer3 (5 * 150 = 750)
      // Total cost = 1750
      const result = strategy.calculateCost(layers, 10, variantId);

      expect(result.units).toBe(10);
      expect(result.totalCostCents).toBe(1750);
      expect(result.unitCostCents).toBe(175);
    });

    it("should not mutate the remaining quantity of the cost layers", () => {
      const layers = [
        createLayer("layer1", 10, 100, new Date("2023-01-01")),
        createLayer("layer2", 5, 200, new Date("2023-01-03")),
      ];

      strategy.calculateCost(layers, 10, variantId);

      expect(layers[0].remainingQuantity).toBe(10);
      expect(layers[1].remainingQuantity).toBe(5);
    });

    it("should throw InsufficientInventoryException if requested quantity exceeds available", () => {
      const layers = [
        createLayer("layer1", 5, 100, new Date("2023-01-01")),
      ];

      expect(() => {
        strategy.calculateCost(layers, 10, variantId);
      }).toThrow(InsufficientInventoryException);

      expect(() => {
        strategy.calculateCost(layers, 10, variantId);
      }).toThrowError(
        `Insufficient stock for variant ${variantId}. Available: 5, Requested: 10.`
      );
    });

    it("should return 0 cost for 0 quantity", () => {
      const layers = [
        createLayer("layer1", 10, 100, new Date("2023-01-01")),
      ];

      const result = strategy.calculateCost(layers, 0, variantId);

      expect(result.units).toBe(0);
      expect(result.totalCostCents).toBe(0);
      expect(result.unitCostCents).toBe(0);
    });

    it("should throw InsufficientInventoryException for empty layers and non-zero quantity", () => {
      expect(() => {
        strategy.calculateCost([], 5, variantId);
      }).toThrow(InsufficientInventoryException);
    });
  });

  describe("consumeLayers", () => {
    it("should consume layers using LIFO (Last-In-First-Out) order", () => {
      const layers = [
        createLayer("layer1", 10, 100, new Date("2023-01-01")), // Oldest
        createLayer("layer2", 5, 200, new Date("2023-01-03")),  // Newest
        createLayer("layer3", 8, 150, new Date("2023-01-02")),  // Middle
      ];

      // Request 10 items
      // Expect 5 from layer2, 5 from layer3
      const result = strategy.consumeLayers(layers, 10, variantId);

      expect(result.units).toBe(10);
      expect(result.totalCostCents).toBe(1750);

      // Verify mutations
      const sortedByOriginalId = [...layers].sort((a, b) => a.id.localeCompare(b.id));
      expect(sortedByOriginalId[0].remainingQuantity).toBe(10); // layer1 untouched
      expect(sortedByOriginalId[1].remainingQuantity).toBe(0);  // layer2 fully consumed
      expect(sortedByOriginalId[2].remainingQuantity).toBe(3);  // layer3 partially consumed
    });

    it("should throw InsufficientInventoryException if requested quantity exceeds available and partially mutate before throwing", () => {
      const layers = [
        createLayer("layer1", 5, 100, new Date("2023-01-01")),
        createLayer("layer2", 5, 200, new Date("2023-01-03")),
      ];

      expect(() => {
        strategy.consumeLayers(layers, 15, variantId);
      }).toThrow(InsufficientInventoryException);

      // Depending on the implementation, it might partially consume before throwing.
      // Based on the code, it consumes in the loop and then throws after the loop.
      expect(layers[0].remainingQuantity).toBe(0);
      expect(layers[1].remainingQuantity).toBe(0);
    });

    it("should return 0 cost and not mutate layers for 0 quantity", () => {
      const layers = [
        createLayer("layer1", 10, 100, new Date("2023-01-01")),
      ];

      const result = strategy.consumeLayers(layers, 0, variantId);

      expect(result.units).toBe(0);
      expect(result.totalCostCents).toBe(0);
      expect(layers[0].remainingQuantity).toBe(10);
    });

    it("should throw InsufficientInventoryException for empty layers and non-zero quantity", () => {
      expect(() => {
        strategy.consumeLayers([], 5, variantId);
      }).toThrow(InsufficientInventoryException);
    });
  });
});
