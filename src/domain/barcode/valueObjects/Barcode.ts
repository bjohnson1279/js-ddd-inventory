import { BarcodeSymbology, getBarcodeSymbologyLabel } from "../enums/BarcodeSymbology";

export class Barcode {
  public readonly value: string;

  constructor(
    public readonly symbology: BarcodeSymbology,
    rawValue: string
  ) {
    this.value = rawValue.trim().toUpperCase();
    this.validate();
  }

  public equals(other: Barcode): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }

  private validate(): void {
    switch (this.symbology) {
      case BarcodeSymbology.UPC_A:
        this.validateUpcA();
        break;
      case BarcodeSymbology.EAN_13:
        this.validateEan13();
        break;
      case BarcodeSymbology.UPC_E:
      case BarcodeSymbology.EAN_8:
        this.validateFixedLength(8);
        break;
      case BarcodeSymbology.ITF_14:
        this.validateFixedLength(14);
        break;
      case BarcodeSymbology.CODE_128:
      case BarcodeSymbology.GS1_128:
        this.validateCode128();
        break;
      case BarcodeSymbology.QR:
        this.validateQr();
        break;
      default:
        throw new Error(`Unsupported symbology: ${this.symbology}`);
    }
  }

  private validateUpcA(): void {
    if (!/^\d{12}$/.test(this.value)) {
      throw new Error(`UPC-A must be exactly 12 digits: ${this.value}`);
    }
    if (!$this_isValidGS1CheckDigit(this.value)) {
      throw new Error(`UPC-A check digit is invalid: ${this.value}`);
    }
  }

  private validateEan13(): void {
    if (!/^\d{13}$/.test(this.value)) {
      throw new Error(`EAN-13 must be exactly 13 digits: ${this.value}`);
    }
    if (!$this_isValidGS1CheckDigit(this.value)) {
      throw new Error(`EAN-13 check digit is invalid: ${this.value}`);
    }
  }

  private validateFixedLength(length: number): void {
    if (!new RegExp(`^\\d{${length}}$`).test(this.value)) {
      throw new Error(
        `${getBarcodeSymbologyLabel(this.symbology)} must be exactly ${length} digits: ${this.value}`
      );
    }
  }

  private validateCode128(): void {
    if (this.value.length === 0 || !/^[\x20-\x7E]+$/.test(this.value)) {
      throw new Error(
        `Code 128 value contains invalid characters: ${this.value}`
      );
    }
  }

  private validateQr(): void {
    if (this.value.length === 0) {
      throw new Error("QR code value cannot be empty.");
    }
    if (this.value.length > 2953) {
      throw new Error("QR code value exceeds maximum length.");
    }
  }
}

function $this_isValidGS1CheckDigit(digits: string): boolean {
  let sum = 0;
  const length = digits.length;

  for (let i = 0; i < length - 1; i++) {
    const digit = parseInt(digits[i], 10);
    const weight = ((length - 1 - i) % 2 === 1) ? 3 : 1;
    sum += digit * weight;
  }

  const calculatedCheck = (10 - (sum % 10)) % 10;
  const providedCheck = parseInt(digits[length - 1], 10);

  return calculatedCheck === providedCheck;
}
