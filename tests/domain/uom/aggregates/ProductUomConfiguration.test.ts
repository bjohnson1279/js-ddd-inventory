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
});
