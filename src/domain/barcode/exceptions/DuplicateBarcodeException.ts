export class DuplicateBarcodeException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateBarcodeException";
  }
}
