import { UomQuantity } from "../valueObjects/UomQuantity";
import { UnitOfMeasure } from "../valueObjects/UnitOfMeasure";
import { ProductUomConfiguration } from "../aggregates/ProductUomConfiguration";
import { IncompatibleUnitsException } from "../exceptions/IncompatibleUnitsException";

export class UomConverter {
  /**
   * Convert a quantity from one unit to another.
   * Both units must be compatible (same category) and known to the config.
   */
  public convert(
    from: UomQuantity,
    toUnit: UnitOfMeasure,
    config: ProductUomConfiguration
  ): UomQuantity {
    if (from.unit.equals(toUnit)) {
      return from;
    }

    if (!from.unit.isCompatibleWith(toUnit)) {
      throw new IncompatibleUnitsException(
        `Cannot convert ${from.unit.category} to ${toUnit.category}.`
      );
    }

    // Step 1: convert to base unit
    const inBase = from.amount * config.factorToBase(from.unit);

    // Step 2: convert base to target unit
    const targetFactor = config.factorToBase(toUnit);
    const converted = inBase / targetFactor;

    return new UomQuantity(converted, toUnit);
  }

  /**
   * Convenience: convert directly to the product's base unit.
   * This is what you call before writing to the ledger.
   */
  public toBaseUnit(
    quantity: UomQuantity,
    config: ProductUomConfiguration
  ): UomQuantity {
    return this.convert(quantity, config.getBaseUnit(), config);
  }

  /**
   * Convert a unit cost from one unit to another.
   * e.g. $14.40 per case → $0.60 per each
   *
   * @param costCentsPerUnit  Cost in cents for 1 unit of perUnit
   * @return                  Cost in cents per 1 unit of targetUnit
   */
  public convertCost(
    costCentsPerUnit: number,
    perUnit: UnitOfMeasure,
    targetUnit: UnitOfMeasure,
    config: ProductUomConfiguration
  ): number {
    if (perUnit.equals(targetUnit)) {
      return costCentsPerUnit;
    }

    // Factor: how many targetUnits equal 1 perUnit
    const factorPerToBase = config.factorToBase(perUnit);
    const factorTargetToBase = config.factorToBase(targetUnit);

    // Cost per target unit = (cost per source unit) / (source units per target unit)
    const ratio = factorPerToBase / factorTargetToBase;

    return Math.round(costCentsPerUnit / ratio);
  }
}
