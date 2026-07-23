import { SerialNumber } from "../../serial/valueObjects/SerialNumber";

export class RfidTag {
  public readonly epc: string;
  public readonly sku: string;
  public readonly serialNumber: SerialNumber;
  public readonly status: string;
  public readonly lastSeenAt: Date | null;
  public readonly lastLocation: string | null;

  constructor(
    epc: string,
    sku: string,
    serialNumber: string | SerialNumber,
    status: string = "ACTIVE",
    lastSeenAt: Date | null = null,
    lastLocation: string | null = null
  ) {
    const normalizedEpc = epc.trim().toUpperCase();
    if (!/^[0-9A-F]{24}$/.test(normalizedEpc)) {
      throw new Error(`RFID EPC must be a 24-character hexadecimal string. Got: ${epc}`);
    }

    const trimmedSku = sku.trim();
    if (trimmedSku.length === 0) {
      throw new Error("SKU cannot be empty.");
    }

    this.epc = normalizedEpc;
    this.sku = trimmedSku;
    this.serialNumber = serialNumber instanceof SerialNumber ? serialNumber : new SerialNumber(serialNumber);
    this.status = status;
    this.lastSeenAt = lastSeenAt;
    this.lastLocation = lastLocation;
  }
}
