import { VariantAttribute } from "./VariantAttribute";

export class VariantAttributeSet {
  private readonly attributes: VariantAttribute[];

  constructor(attributes: VariantAttribute[]) {
    if (!attributes || attributes.length === 0) {
      throw new Error("A variant must have at least one attribute.");
    }

    this.attributes = [...attributes].sort((a, b) => a.name.localeCompare(b.name));
  }

  public equals(other: VariantAttributeSet): boolean {
    if (this.attributes.length !== other.attributes.length) {
      return false;
    }
    for (let i = 0; i < this.attributes.length; i++) {
      if (!this.attributes[i].equals(other.attributes[i])) {
        return false;
      }
    }
    return true;
  }

  public all(): VariantAttribute[] {
    return [...this.attributes];
  }

  public toArray(): { name: string; value: string }[] {
    return this.attributes.map((a) => ({ name: a.name, value: a.value }));
  }
}
