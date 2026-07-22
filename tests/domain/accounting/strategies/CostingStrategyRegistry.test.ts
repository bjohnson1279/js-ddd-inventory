import { CostingStrategyRegistry } from "../../../../src/domain/accounting/strategies/CostingStrategyRegistry";
import { CostingMethod } from "../../../../src/domain/accounting/enums/CostingMethod";
import { FifoCostingStrategy } from "../../../../src/domain/accounting/strategies/FifoCostingStrategy";
import { LifoCostingStrategy } from "../../../../src/domain/accounting/strategies/LifoCostingStrategy";
import { WeightedAverageCostingStrategy } from "../../../../src/domain/accounting/strategies/WeightedAverageCostingStrategy";

describe("CostingStrategyRegistry", () => {
  describe("get", () => {
    it("should return FifoCostingStrategy for FIFO method", () => {
      const strategy = CostingStrategyRegistry.get(CostingMethod.FIFO);
      expect(strategy).toBeInstanceOf(FifoCostingStrategy);
    });

    it("should return LifoCostingStrategy for LIFO method", () => {
      const strategy = CostingStrategyRegistry.get(CostingMethod.LIFO);
      expect(strategy).toBeInstanceOf(LifoCostingStrategy);
    });

    it("should return WeightedAverageCostingStrategy for WeightedAverageCost method", () => {
      const strategy = CostingStrategyRegistry.get(
        CostingMethod.WeightedAverageCost
      );
      expect(strategy).toBeInstanceOf(WeightedAverageCostingStrategy);
    });

    it("should throw an error for unsupported costing method SpecificIdentification", () => {
      expect(() =>
        CostingStrategyRegistry.get(CostingMethod.SpecificIdentification)
      ).toThrow("Unsupported costing method: specific_identification");
    });

    it("should throw an error for completely invalid costing method", () => {
      expect(() =>
        CostingStrategyRegistry.get("invalid_method" as CostingMethod)
      ).toThrow("Unsupported costing method: invalid_method");
    });
  });
});
