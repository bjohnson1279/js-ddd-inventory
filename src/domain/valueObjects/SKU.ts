export class SKU {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(value: string): SKU {
    if (!value || value.trim().length === 0) {
      throw new Error("SKU cannot be empty");
    }
    // simple validation, e.g. minimum 3 chars
    if (value.trim().length < 3) {
      throw new Error("SKU must be at least 3 characters long");
    }
    return new SKU(value.trim().toUpperCase());
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: SKU): boolean {
    return this.value === other.getValue();
  }
}
