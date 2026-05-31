import { SerialNumber } from "../valueObjects/SerialNumber";

export class SerialNumberNotFoundException extends Error {
  constructor(public readonly serialNumber: SerialNumber) {
    super(`Serial number ${serialNumber.value} not found.`);
    this.name = "SerialNumberNotFoundException";
  }
}
