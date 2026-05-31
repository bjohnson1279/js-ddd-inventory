export class BarcodeNotFoundException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BarcodeNotFoundException";
  }
}
