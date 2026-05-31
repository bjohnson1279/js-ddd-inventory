import { SerialNumber } from "../valueObjects/SerialNumber";

export class SerialNumberAlreadyRegisteredException extends Error {
  constructor(public readonly serialNumber: SerialNumber) {
    super(`Serial number ${serialNumber.value} is already registered.`);
    this.name = "SerialNumberAlreadyRegisteredException";
  }
}
