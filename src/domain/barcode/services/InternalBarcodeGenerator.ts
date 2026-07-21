import { Barcode } from "../valueObjects/Barcode";
import { BarcodeSymbology } from "../enums/BarcodeSymbology";
import { BarcodeRegistry } from "./BarcodeRegistry";
import * as crypto from "crypto";

export class InternalBarcodeGenerator {
  private static readonly PREFIX = "INV";

  constructor(private readonly registry: BarcodeRegistry) {}

  public async generate(variantId: string, tenantId?: string): Promise<Barcode> {
    let attempts = 0;
    let value = "";

    do {
      value = this.buildValue(variantId, tenantId || "DEFAULT", attempts);
      attempts++;

      if (attempts > 5) {
        throw new Error("Could not generate a unique barcode after 5 attempts.");
      }
    } while (await this.registry.isRegistered(value));

    return new Barcode(BarcodeSymbology.CODE_128, value);
  }

  private buildValue(variantId: string, tenantId: string, salt: number): string {
    const tenantHash = crypto
      .createHash("sha256")
      .update(tenantId)
      .digest("hex")
      .substring(0, 4)
      .toUpperCase();

    const variantHash = crypto
      .createHash("sha256")
      .update(variantId + salt)
      .digest("hex")
      .substring(0, 8)
      .toUpperCase();

    return `${InternalBarcodeGenerator.PREFIX}-${tenantHash}-${variantHash}`;
  }
}
