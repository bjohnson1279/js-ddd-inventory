import { Barcode } from '../../../../src/domain/barcode/valueObjects/Barcode';
import { BarcodeSymbology } from '../../../../src/domain/barcode/enums/BarcodeSymbology';

describe('Barcode', () => {
  it('throws an error when instantiated with an empty string', () => {
    expect(() => new Barcode(BarcodeSymbology.UPC_A, '')).toThrow('Invalid barcode');
  });

  it('throws an error when instantiated with only whitespace', () => {
    expect(() => new Barcode(BarcodeSymbology.UPC_A, '   ')).toThrow('Invalid barcode');
  });
});
