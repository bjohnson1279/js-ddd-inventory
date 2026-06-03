import { Barcode } from "../../../src/domain/barcode/valueObjects/Barcode";
import { BarcodeSymbology } from "../../../src/domain/barcode/enums/BarcodeSymbology";

describe("Barcode Value Object", () => {
  it("should create valid UPC-A barcodes and validate check digits", () => {
    const barcode = new Barcode(BarcodeSymbology.UPC_A, "012345678905");
    expect(barcode.value).toBe("012345678905");

    expect(() => new Barcode(BarcodeSymbology.UPC_A, "012345678904")).toThrow(/check digit/i);
    expect(() => new Barcode(BarcodeSymbology.UPC_A, "12345")).toThrow(/12 digits/i);
  });

  it("should create valid EAN-13 barcodes and validate check digits", () => {
    const barcode = new Barcode(BarcodeSymbology.EAN_13, "4006381333931");
    expect(barcode.value).toBe("4006381333931");

    expect(() => new Barcode(BarcodeSymbology.EAN_13, "4006381333932")).toThrow(/check digit/i);
  });

  it("should validate fixed length numeric barcodes", () => {
    const barcode = new Barcode(BarcodeSymbology.EAN_8, "12345678");
    expect(barcode.value).toBe("12345678");
    expect(() => new Barcode(BarcodeSymbology.EAN_8, "1234567")).toThrow(/8 digits/i);

    const itf = new Barcode(BarcodeSymbology.ITF_14, "12345678901234");
    expect(itf.value).toBe("12345678901234");
    expect(() => new Barcode(BarcodeSymbology.ITF_14, "1234567890123")).toThrow(/14 digits/i);
  });

  it("should validate Code 128 barcodes", () => {
    const code = new Barcode(BarcodeSymbology.CODE_128, "INV-1234-ABCD");
    expect(code.value).toBe("INV-1234-ABCD");

    expect(() => new Barcode(BarcodeSymbology.CODE_128, "INV-12\x07")).toThrow(/invalid characters/i);
  });

  it("should validate QR codes", () => {
    const qr = new Barcode(BarcodeSymbology.QR, "https://example.com/item/123");
    expect(qr.value).toBe("HTTPS://EXAMPLE.COM/ITEM/123");

    expect(() => new Barcode(BarcodeSymbology.QR, "")).toThrow(/empty/i);
  });

  it("should throw an error for unsupported barcode symbology", () => {
    expect(() => new Barcode("INVALID_SYMBOLOGY" as BarcodeSymbology, "123")).toThrow(/Unsupported symbology/i);
  });
});
