export class IncompatibleUnitsException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncompatibleUnitsException";
  }
}
