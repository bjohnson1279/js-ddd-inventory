import { CostingMethod } from "../enums/CostingMethod";
import { ICostingStrategy } from "./ICostingStrategy";
import { FifoCostingStrategy } from "./FifoCostingStrategy";
import { LifoCostingStrategy } from "./LifoCostingStrategy";
import { WeightedAverageCostingStrategy } from "./WeightedAverageCostingStrategy";

export class CostingStrategyRegistry {
  private static strategies: Map<CostingMethod, ICostingStrategy> = new Map([
    [CostingMethod.FIFO, new FifoCostingStrategy()],
    [CostingMethod.LIFO, new LifoCostingStrategy()],
    [CostingMethod.WeightedAverageCost, new WeightedAverageCostingStrategy()],
  ]);

  public static get(method: CostingMethod): ICostingStrategy {
    const strategy = this.strategies.get(method);
    if (!strategy) {
      throw new Error(`Unsupported costing method: ${method}`);
    }
    return strategy;
  }
}
