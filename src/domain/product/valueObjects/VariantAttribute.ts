export class VariantAttribute {
  constructor(
    public readonly name: string,
    public readonly value: string
  ) {
    if (name.trim().length === 0 || value.trim().length === 0) {
      throw new Error("Attribute name and value must be non-empty.");
    }
  }

  public equals(other: VariantAttribute): boolean {
    return (
      this.name.toLowerCase() === other.name.toLowerCase() &&
      this.value.toLowerCase() === other.value.toLowerCase()
    );
  }
}
