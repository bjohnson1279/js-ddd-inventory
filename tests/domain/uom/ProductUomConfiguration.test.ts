import { ProductUomConfiguration } from '../../../src/domain/uom/aggregates/ProductUomConfiguration';
import { UnitOfMeasure } from '../../../src/domain/uom/valueObjects/UnitOfMeasure';
import { UomCategory } from '../../../src/domain/uom/enums/UomCategory';

describe('ProductUomConfiguration', () => {
  describe('addConversionRule', () => {
    it('throws an error when trying to add a conversion rule for the base unit itself', () => {
      const baseUnit = new UnitOfMeasure('Each', 'ea', UomCategory.Discrete);
      const configuration = new ProductUomConfiguration('config-1', 'variant-1', baseUnit);

      expect(() => {
        configuration.addConversionRule(baseUnit, 1, 'Base unit rule');
      }).toThrow('Cannot add a conversion rule for the base unit itself.');
    });
  });
});
