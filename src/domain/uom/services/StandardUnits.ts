import { UnitOfMeasure } from "../valueObjects/UnitOfMeasure";
import { UomCategory } from "../enums/UomCategory";
import { IncompatibleUnitsException } from "../exceptions/IncompatibleUnitsException";

export class StandardUnits {
  // --- Discrete ---
  public static each(): UnitOfMeasure {
    return new UnitOfMeasure('Each', 'ea', UomCategory.Discrete);
  }

  public static dozen(): UnitOfMeasure {
    return new UnitOfMeasure('Dozen', 'dz', UomCategory.Discrete);
  }

  // --- Weight ---
  public static gram(): UnitOfMeasure {
    return new UnitOfMeasure('Gram', 'g', UomCategory.Weight);
  }

  public static kilogram(): UnitOfMeasure {
    return new UnitOfMeasure('Kilogram', 'kg', UomCategory.Weight);
  }

  public static ounce(): UnitOfMeasure {
    return new UnitOfMeasure('Ounce', 'oz', UomCategory.Weight);
  }

  public static pound(): UnitOfMeasure {
    return new UnitOfMeasure('Pound', 'lb', UomCategory.Weight);
  }

  // --- Volume ---
  public static milliliter(): UnitOfMeasure {
    return new UnitOfMeasure('Milliliter', 'ml', UomCategory.Volume);
  }

  public static liter(): UnitOfMeasure {
    return new UnitOfMeasure('Liter', 'l', UomCategory.Volume);
  }

  public static fluidOunce(): UnitOfMeasure {
    return new UnitOfMeasure('Fluid Ounce', 'fl oz', UomCategory.Volume);
  }

  public static gallon(): UnitOfMeasure {
    return new UnitOfMeasure('Gallon', 'gal', UomCategory.Volume);
  }

  public static weightFactorToGrams(unit: UnitOfMeasure): number {
    switch (unit.name) {
      case 'Gram': return 1.0;
      case 'Kilogram': return 1000.0;
      case 'Ounce': return 28.3495;
      case 'Pound': return 453.592;
      default:
        throw new IncompatibleUnitsException(`Unknown weight unit: ${unit.name}`);
    }
  }

  public static volumeFactorToMilliliters(unit: UnitOfMeasure): number {
    switch (unit.name) {
      case 'Milliliter': return 1.0;
      case 'Liter': return 1000.0;
      case 'Fluid Ounce': return 29.5735;
      case 'Cup': return 236.588;
      case 'Gallon': return 3785.41;
      default:
        throw new IncompatibleUnitsException(`Unknown volume unit: ${unit.name}`);
    }
  }
}
