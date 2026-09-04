import { Barcode } from '../../../../src/domain/barcode/valueObjects/Barcode';
import { BarcodeSymbology } from '../../../../src/domain/barcode/enums/BarcodeSymbology';

describe('Barcode', () => {
  it('throws an error when instantiated with an empty string', () => {
    expect(() => new Barcode(BarcodeSymbology.UPC_A, '')).toThrow('Invalid barcode');
  });

  it('throws an error when instantiated with only whitespace', () => {
    expect(() => new Barcode(BarcodeSymbology.UPC_A, '   ')).toThrow('Invalid barcode');
  });

  describe('UPC-A validation', () => {
    it('accepts a valid UPC-A barcode', () => {
      const barcode = new Barcode(BarcodeSymbology.UPC_A, '012345678905');
      expect(barcode.value).toBe('012345678905');
    });

    it('throws an error if UPC-A is not exactly 12 digits', () => {
      expect(() => new Barcode(BarcodeSymbology.UPC_A, '01234567890')).toThrow('UPC-A must be exactly 12 digits: 01234567890');
      expect(() => new Barcode(BarcodeSymbology.UPC_A, '0123456789051')).toThrow('UPC-A must be exactly 12 digits: 0123456789051');
      expect(() => new Barcode(BarcodeSymbology.UPC_A, '01234567890A')).toThrow('UPC-A must be exactly 12 digits: 01234567890A');
    });

    it('throws an error if UPC-A check digit is invalid', () => {
      expect(() => new Barcode(BarcodeSymbology.UPC_A, '012345678904')).toThrow('UPC-A check digit is invalid: 012345678904');
    });
  });

  describe('EAN-13 validation', () => {
    it('accepts a valid EAN-13 barcode', () => {
      const barcode = new Barcode(BarcodeSymbology.EAN_13, '4006381333931');
      expect(barcode.value).toBe('4006381333931');
    });

    it('throws an error if EAN-13 is not exactly 13 digits', () => {
      expect(() => new Barcode(BarcodeSymbology.EAN_13, '400638133393')).toThrow('EAN-13 must be exactly 13 digits: 400638133393');
      expect(() => new Barcode(BarcodeSymbology.EAN_13, '40063813339312')).toThrow('EAN-13 must be exactly 13 digits: 40063813339312');
      expect(() => new Barcode(BarcodeSymbology.EAN_13, '400638133393A')).toThrow('EAN-13 must be exactly 13 digits: 400638133393A');
    });

    it('throws an error if EAN-13 check digit is invalid', () => {
      expect(() => new Barcode(BarcodeSymbology.EAN_13, '4006381333932')).toThrow('EAN-13 check digit is invalid: 4006381333932');
    });
  });

  describe('QR validation', () => {
    it('accepts a valid QR code', () => {
      const barcode = new Barcode(BarcodeSymbology.QR, 'https://example.com');
      expect(barcode.value).toBe('HTTPS://EXAMPLE.COM');
    });

    it('throws an error if QR code value exceeds maximum length', () => {
      const longString = 'A'.repeat(2954);
      expect(() => new Barcode(BarcodeSymbology.QR, longString)).toThrow('QR code value exceeds maximum length.');
    });
  });
});
