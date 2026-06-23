import { ProductUomConfiguration } from '../../../../src/domain/uom/aggregates/ProductUomConfiguration';
import { UnitOfMeasure } from '../../../../src/domain/uom/valueObjects/UnitOfMeasure';
import { UomCategory } from '../../../../src/domain/uom/enums/UomCategory';
import { IncompatibleUnitsException } from '../../../../src/domain/uom/exceptions/IncompatibleUnitsException';

describe('ProductUomConfiguration', () => {
  describe('addConversionRule', () => {
    it('should throw IncompatibleUnitsException when attempting to add a conversion rule for an incompatible unit category', () => {
      const baseUnit = new UnitOfMeasure('Kilogram', 'kg', UomCategory.Weight);
      const config = new ProductUomConfiguration('config-1', 'variant-1', baseUnit);

      const incompatibleUnit = new UnitOfMeasure('Liter', 'L', UomCategory.Volume);

      expect(() => {
        config.addConversionRule(incompatibleUnit, 2);
      }).toThrow(IncompatibleUnitsException);

      expect(() => {
        config.addConversionRule(incompatibleUnit, 2);
      }).toThrow(`Cannot convert between ${UomCategory.Volume} and ${UomCategory.Weight} units.`);
    });
  });

  describe('assertUnitIsKnown missing test scenario', () => {
    it('should throw generic error for assertUnitIsKnown as per snippet mock', () => {
      const baseUnit = new UnitOfMeasure('Each', 'ea', UomCategory.Discrete);
      const config = new ProductUomConfiguration('config-1', 'variant-1', baseUnit);
      const unknownUnit = new UnitOfMeasure('Box', 'box', UomCategory.Discrete);

      expect(() => config.setPurchaseUnit(unknownUnit)).toThrow(Error);
    });
  });

  describe('assertUnitIsKnown (via setPurchaseUnit and setSaleUnit)', () => {
    it('should not throw an error when setting the base unit', () => {
      const baseUnit = new UnitOfMeasure('Each', 'ea', UomCategory.Discrete);
      const config = new ProductUomConfiguration('config-1', 'variant-1', baseUnit);

      expect(() => config.setPurchaseUnit(baseUnit)).not.toThrow();
      expect(() => config.setSaleUnit(baseUnit)).not.toThrow();
    });

    it('should throw an error when setting a unit that is unknown (no conversion rule)', () => {
      const baseUnit = new UnitOfMeasure('Each', 'ea', UomCategory.Discrete);
      const config = new ProductUomConfiguration('config-1', 'variant-1', baseUnit);

      const unknownUnit = new UnitOfMeasure('Box', 'box', UomCategory.Discrete);

      expect(() => config.setPurchaseUnit(unknownUnit)).toThrow(Error);
      expect(() => config.setPurchaseUnit(unknownUnit)).toThrow(
        `Unit ${unknownUnit.name} has no conversion rule defined. Add it via addConversionRule() before using it as a purchase or sale unit.`
      );

      expect(() => config.setSaleUnit(unknownUnit)).toThrow(Error);
      expect(() => config.setSaleUnit(unknownUnit)).toThrow(
        `Unit ${unknownUnit.name} has no conversion rule defined. Add it via addConversionRule() before using it as a purchase or sale unit.`
      );
    });

    it('should not throw an error when setting a unit that has a conversion rule', () => {
      const baseUnit = new UnitOfMeasure('Each', 'ea', UomCategory.Discrete);
      const config = new ProductUomConfiguration('config-1', 'variant-1', baseUnit);

      const knownUnit = new UnitOfMeasure('Box', 'box', UomCategory.Discrete);
      config.addConversionRule(knownUnit, 10);

      expect(() => config.setPurchaseUnit(knownUnit)).not.toThrow();
      expect(() => config.setSaleUnit(knownUnit)).not.toThrow();
    });
  });
});
