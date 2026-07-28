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

    it("should handle extremely large input lengths and sort correctly (e.g. 10,000 layers)", () => {
      // i=0 is newest, i=9999 is oldest. Cost = 100 + i (so newer layers are cheaper in this setup)
      const layers = Array.from({ length: 10000 }).map((_, i) =>
        createLayer(`layer${i}`, 1, 100 + i, new Date(Date.now() - i * 1000))
      );

      const result = strategy.calculateCost(layers, 5000, variantId);
      expect(result.units).toBe(5000);

      // Since it's LIFO, it should consume the newest 5000 layers (i=0 to 4999).
      // Sum of (100 + i) for i=0 to 4999:
      // = 5000 * 100 + Sum(i=0 to 4999)
      // = 500000 + (4999 * 5000) / 2
      // = 500000 + 12497500 = 12997500
      expect(result.totalCostCents).toBe(12997500);
    });

    it("should handle requested quantity exactly matching total available", () => {
      const layers = [
        createLayer("layer1", 5, 100, new Date("2023-01-01")),
        createLayer("layer2", 5, 200, new Date("2023-01-02")),
      ];
      const result = strategy.calculateCost(layers, 10, variantId);
      expect(result.units).toBe(10);
      expect(result.totalCostCents).toBe(1500);
    });

    it("should return 0 cost for negative or NaN requested quantities", () => {
      const layers = [
        createLayer("layer1", 10, 100, new Date("2023-01-01")),
      ];

      const resultNeg = strategy.calculateCost(layers, -5, variantId);
      expect(resultNeg.units).toBe(-5);
      expect(resultNeg.totalCostCents).toBe(0);

      const resultNaN = strategy.calculateCost(layers, NaN, variantId);
      expect(resultNaN.totalCostCents).toBe(0);
    });

    it("should maintain stable sort when receivedAt timestamps are identical", () => {
      // In JS sort, if we return 0, original order is preserved depending on engine,
      // but the math should work properly regardless.
      const identicalDate = new Date("2023-01-01");
      const layers = [
        createLayer("layer1", 5, 100, identicalDate),
        createLayer("layer2", 5, 200, identicalDate),
      ];
      const result = strategy.calculateCost(layers, 5, variantId);
      expect(result.units).toBe(5);
      // It should consume 5 from whichever it sorts first
      expect([500, 1000]).toContain(result.totalCostCents);
    });

    it("should handle null or undefined layers array gracefully (or throw a TypeError)", () => {
      expect(() => {
        strategy.calculateCost(null as any, 5, variantId);
      }).toThrow(TypeError);
      expect(() => {
        strategy.calculateCost(undefined as any, 5, variantId);
      }).toThrow(TypeError);
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

    it("should handle extremely large input lengths and sort correctly (e.g. 10,000 layers)", () => {
      // i=0 is newest, i=9999 is oldest. Cost = 100 + i
      const layers = Array.from({ length: 10000 }).map((_, i) =>
        createLayer(`layer${i}`, 1, 100 + i, new Date(Date.now() - i * 1000))
      );
      const result = strategy.consumeLayers(layers, 5000, variantId);
      expect(result.units).toBe(5000);

      // Sum of (100 + i) for i=0 to 4999 (the newest layers)
      expect(result.totalCostCents).toBe(12997500);

      // Verify exactly which layers were consumed
      const sortedByOriginalId = [...layers].sort((a, b) => {
         // Sort back by ID to check the first 5000 vs last 5000
         const aId = parseInt(a.id.replace('layer', ''));
         const bId = parseInt(b.id.replace('layer', ''));
         return aId - bId;
      });

      // The newest 5000 (i=0 to 4999) should be fully consumed
      expect(sortedByOriginalId[0].remainingQuantity).toBe(0);
      expect(sortedByOriginalId[4999].remainingQuantity).toBe(0);

      // The oldest 5000 (i=5000 to 9999) should be untouched
      expect(sortedByOriginalId[5000].remainingQuantity).toBe(1);
      expect(sortedByOriginalId[9999].remainingQuantity).toBe(1);
    });

    it("should handle requested quantity exactly matching total available", () => {
      const layers = [
        createLayer("layer1", 5, 100, new Date("2023-01-01")),
        createLayer("layer2", 5, 200, new Date("2023-01-02")),
      ];
      const result = strategy.consumeLayers(layers, 10, variantId);
      expect(result.units).toBe(10);
      expect(result.totalCostCents).toBe(1500);
      expect(layers[0].remainingQuantity).toBe(0);
      expect(layers[1].remainingQuantity).toBe(0);
    });

    it("should return 0 cost and not mutate layers for negative or NaN requested quantities", () => {
      const layers = [
        createLayer("layer1", 10, 100, new Date("2023-01-01")),
      ];

      const resultNeg = strategy.consumeLayers(layers, -5, variantId);
      expect(resultNeg.units).toBe(-5);
      expect(resultNeg.totalCostCents).toBe(0);
      expect(layers[0].remainingQuantity).toBe(10);

      const resultNaN = strategy.consumeLayers(layers, NaN, variantId);
      expect(resultNaN.totalCostCents).toBe(0);
      expect(layers[0].remainingQuantity).toBe(10);
    });

    it("should maintain stable sort and mutate correctly when receivedAt timestamps are identical", () => {
      const identicalDate = new Date("2023-01-01");
      const layers = [
        createLayer("layer1", 5, 100, identicalDate),
        createLayer("layer2", 5, 200, identicalDate),
      ];
      const result = strategy.consumeLayers(layers, 5, variantId);
      expect(result.units).toBe(5);
      expect([500, 1000]).toContain(result.totalCostCents);
      // One should be 5, one should be 0
      const remainingQuantities = layers.map(l => l.remainingQuantity).sort();
      expect(remainingQuantities).toEqual([0, 5]);
    });

    it("should handle null or undefined layers array gracefully (or throw a TypeError)", () => {
      expect(() => {
        strategy.consumeLayers(null as any, 5, variantId);
      }).toThrow(TypeError);
      expect(() => {
        strategy.consumeLayers(undefined as any, 5, variantId);
      }).toThrow(TypeError);
    });
  });
});
