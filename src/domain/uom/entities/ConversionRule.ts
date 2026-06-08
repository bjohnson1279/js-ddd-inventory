import { UnitOfMeasure } from "../valueObjects/UnitOfMeasure";

export class ConversionRule {
  constructor(
    public readonly id: string,
    public readonly unit: UnitOfMeasure, // the non-base unit (e.g. Case)
    public readonly factorToBase: number, // 1 Case = 24 Each → factorToBase = 24
    public readonly label: string | null = null // optional display label: "Case of 24"
  ) {
    if (Number.isNaN(factorToBase) || factorToBase <= 0) {
      throw new Error(`Conversion factor must be positive; got ${factorToBase}.`);
    }

    if (factorToBase === 1.0) {
      throw new Error(
        'A conversion factor of 1.0 would duplicate the base unit. ' +
          'Only add rules for units that differ from the base.'
      );
    }
  }

  /**
   * The inverse: how many of THIS unit equals one base unit.
   * e.g. if 1 Case = 24 Each, then factorFromBase = 1/24
   */
  public factorFromBase(): number {
    return 1.0 / this.factorToBase;
  }
}
