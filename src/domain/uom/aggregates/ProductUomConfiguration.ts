import { UnitOfMeasure } from "../valueObjects/UnitOfMeasure";
import { ConversionRule } from "../entities/ConversionRule";
import { UomCategory } from "../enums/UomCategory";
import { IncompatibleUnitsException } from "../exceptions/IncompatibleUnitsException";
import { StandardUnits } from "../services/StandardUnits";

export class ProductUomConfiguration {
  private purchaseUnit: UnitOfMeasure | null = null;
  private saleUnit: UnitOfMeasure | null = null;
  private conversionRules: ConversionRule[] = [];

  constructor(
    public readonly id: string,
    public readonly variantId: string,
    private readonly baseUnit: UnitOfMeasure
  ) {}

  public addConversionRule(
    unit: UnitOfMeasure,
    factorToBase: number,
    label: string | null = null
  ): void {
    if (!unit.isCompatibleWith(this.baseUnit)) {
      throw new IncompatibleUnitsException(
        `Cannot convert between ${unit.category} and ${this.baseUnit.category} units.`
      );
    }

    if (unit.equals(this.baseUnit)) {
      throw new Error('Cannot add a conversion rule for the base unit itself.');
    }

    // Prevent duplicate rules for the same unit
    const existing = this.conversionRules.find((r) => r.unit.equals(unit));
    if (existing) {
      throw new Error(`A conversion rule for ${unit.name} already exists. Remove it first.`);
    }

    this.conversionRules.push(
      new ConversionRule(
        Date.now().toString() + Math.random(), // Simple ID for now
        unit,
        factorToBase,
        label
      )
    );
  }

  public removeConversionRule(unit: UnitOfMeasure): void {
    this.conversionRules = this.conversionRules.filter((r) => !r.unit.equals(unit));
  }

  public setPurchaseUnit(unit: UnitOfMeasure): void {
    this.assertUnitIsKnown(unit);
    this.purchaseUnit = unit;
  }

  public setSaleUnit(unit: UnitOfMeasure): void {
    this.assertUnitIsKnown(unit);
    this.saleUnit = unit;
  }

  public getBaseUnit(): UnitOfMeasure {
    return this.baseUnit;
  }

  public getPurchaseUnit(): UnitOfMeasure {
    return this.purchaseUnit ?? this.baseUnit;
  }

  public getSaleUnit(): UnitOfMeasure {
    return this.saleUnit ?? this.baseUnit;
  }

  public factorToBase(unit: UnitOfMeasure): number {
    if (unit.equals(this.baseUnit)) {
      return 1.0;
    }

    // Standard weight conversions — no configuration needed
    if (unit.category === UomCategory.Weight) {
      const unitFactor = StandardUnits.weightFactorToGrams(unit);
      const baseFactor = StandardUnits.weightFactorToGrams(this.baseUnit);
      return unitFactor / baseFactor;
    }

    // Standard volume conversions — no configuration needed
    if (unit.category === UomCategory.Volume) {
      const unitFactor = StandardUnits.volumeFactorToMilliliters(unit);
      const baseFactor = StandardUnits.volumeFactorToMilliliters(this.baseUnit);
      return unitFactor / baseFactor;
    }

    // Discrete: must be in a configured ConversionRule
    const rule = this.conversionRules.find((r) => r.unit.equals(unit));
    if (rule) {
      return rule.factorToBase;
    }

    throw new IncompatibleUnitsException(
      `No conversion rule found for ${unit.name} → ${this.baseUnit.name}. ` +
        'Add a ConversionRule for this product.'
    );
  }

  public getConversionRules(): ConversionRule[] {
    return [...this.conversionRules];
  }

  private assertUnitIsKnown(unit: UnitOfMeasure): void {
    if (unit.equals(this.baseUnit)) {
      return; // base unit is always valid
    }

    const exists = this.conversionRules.some((r) => r.unit.equals(unit));
    if (!exists) {
      throw new Error(
        `Unit ${unit.name} has no conversion rule defined. ` +
          "Add it via addConversionRule() before using it as a purchase or sale unit."
      );
    }
  }
}
