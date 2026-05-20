import { UomCategory } from "../enums/UomCategory";

export class UnitOfMeasure {
  constructor(
    public readonly name: string, // e.g. "Case"
    public readonly abbreviation: string, // e.g. "cs"
    public readonly category: UomCategory
  ) {
    if (!name.trim() || !abbreviation.trim()) {
      throw new Error("UnitOfMeasure name and abbreviation must be non-empty.");
    }
  }

  public equals(other: UnitOfMeasure): boolean {
    // Two units are the same if they share a name and category.
    // Abbreviation differences don't create distinct units.
    return this.name === other.name && this.category === other.category;
  }

  public isCompatibleWith(other: UnitOfMeasure): boolean {
    return this.category === other.category;
  }

  public toString(): string {
    return `${this.name} (${this.abbreviation})`;
  }
}
