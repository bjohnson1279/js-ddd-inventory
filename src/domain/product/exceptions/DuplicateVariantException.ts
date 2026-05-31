export class DuplicateVariantException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateVariantException";
  }
}
