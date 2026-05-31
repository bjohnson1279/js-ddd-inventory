import { Barcode } from "../valueObjects/Barcode";
import { BarcodeSource } from "../enums/BarcodeSource";

export class BarcodeAssignment {
  constructor(
    public readonly id: string,
    public readonly variantId: string,
    public readonly barcode: Barcode,
    public readonly source: BarcodeSource,
    public readonly isPrimary: boolean,
    public readonly assignedAt: Date
  ) {}
}
