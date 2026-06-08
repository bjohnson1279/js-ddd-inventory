import { ProductUomConfiguration } from '../../../src/domain/uom/aggregates/ProductUomConfiguration';
import { UnitOfMeasure } from '../../../src/domain/uom/valueObjects/UnitOfMeasure';
import { UomCategory } from '../../../src/domain/uom/enums/UomCategory';
import { IncompatibleUnitsException } from '../../../src/domain/uom/exceptions/IncompatibleUnitsException';

describe('ProductUomConfiguration', () => {
  describe('addConversionRule', () => {
    it('throws an error when trying to add a conversion rule for incompatible units', () => {
      const weightUnit = new UnitOfMeasure('Gram', 'g', UomCategory.Weight);
      const volumeUnit = new UnitOfMeasure('Liter', 'l', UomCategory.Volume);
      const configuration = new ProductUomConfiguration('config-1', 'variant-1', weightUnit);

      expect(() => {
        configuration.addConversionRule(volumeUnit, 1000);
      }).toThrow(IncompatibleUnitsException);

      expect(() => {
        configuration.addConversionRule(volumeUnit, 1000);
      }).toThrow('Cannot convert between volume and weight units.');
    });

    it('throws an error when trying to add a conversion rule for the base unit itself', () => {
      const baseUnit = new UnitOfMeasure('Each', 'ea', UomCategory.Discrete);
      const configuration = new ProductUomConfiguration('config-1', 'variant-1', baseUnit);

      expect(() => {
        configuration.addConversionRule(baseUnit, 1, 'Base unit rule');
      }).toThrow('Cannot add a conversion rule for the base unit itself.');
    });
  });
});
