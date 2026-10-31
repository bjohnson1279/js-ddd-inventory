import * as crypto from 'crypto';

export class InspectionId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(value?: string | InspectionId): InspectionId {
    if (value instanceof InspectionId) {
      return value;
    }
    const id = value && value.trim().length > 0 ? value.trim() : crypto.randomUUID();
    return new InspectionId(id);
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other?: InspectionId): boolean {
    if (!other) return false;
    return this.value === other.getValue();
  }
}
