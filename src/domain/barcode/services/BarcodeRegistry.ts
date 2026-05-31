import { IBarcodeRepository } from "../../repositories/IBarcodeRepository";
import { BarcodeNotFoundException } from "../exceptions/BarcodeNotFoundException";

export class BarcodeRegistry {
  constructor(private readonly repository: IBarcodeRepository) {}

  /**
   * Resolve a raw scanned value to a variant.
   * Throws BarcodeNotFoundException if not found.
   */
  public async resolve(scannedValue: string): Promise<string> {
    const value = scannedValue.trim().toUpperCase();
    const variantId = await this.repository.findVariantByBarcodeValue(value);

    if (variantId === null) {
      throw new BarcodeNotFoundException(
        `No variant found for barcode: ${scannedValue}`
      );
    }

    return variantId;
  }

  /**
   * Check if a barcode value is already registered (before assigning).
   */
  public async isRegistered(value: string): Promise<boolean> {
    const normalized = value.trim().toUpperCase();
    const variantId = await this.repository.findVariantByBarcodeValue(normalized);
    return variantId !== null;
  }
}
