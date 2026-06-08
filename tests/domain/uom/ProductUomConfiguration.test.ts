import { ProductUomConfiguration } from '../../../src/domain/uom/aggregates/ProductUomConfiguration';
import { UnitOfMeasure } from '../../../src/domain/uom/valueObjects/UnitOfMeasure';
import { UomCategory } from '../../../src/domain/uom/enums/UomCategory';
import { IncompatibleUnitsException } from '../../../src/domain/uom/exceptions/IncompatibleUnitsException';

describe('ProductUomConfiguration', () => {
  describe('addConversionRule', () => {
    it('throws an error when trying to add a conversion rule for an incompatible unit category', () => {
      const baseUnit = new UnitOfMeasure('Kilogram', 'kg', UomCategory.Weight);
      const configuration = new ProductUomConfiguration('config-1', 'variant-1', baseUnit);
      const incompatibleUnit = new UnitOfMeasure('Liter', 'l', UomCategory.Volume);

      expect(() => {
        configuration.addConversionRule(incompatibleUnit, 1, 'Incompatible rule');
      }).toThrow(new IncompatibleUnitsException('Cannot convert between volume and weight units.'));
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
