import { AggregateRoot } from "../../aggregates/AggregateRoot";
import { SKU } from "../../valueObjects/SKU";

export class ReorderPolicy extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly sku: SKU,
    public readonly locationId: string,
    public readonly reorderPoint: number,
    public readonly reorderQuantity: number,
    public readonly safetyStock: number
  ) {
    super();
    if (reorderPoint < 0) {
      throw new Error("Reorder point cannot be negative.");
    }
    if (reorderQuantity <= 0) {
      throw new Error("Reorder quantity must be greater than zero.");
    }
    if (safetyStock < 0) {
      throw new Error("Safety stock cannot be negative.");
    }
  }

  public shouldReorder(currentQuantity: number): boolean {
    return currentQuantity <= this.reorderPoint;
  }
}
