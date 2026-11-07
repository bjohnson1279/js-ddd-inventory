import * as crypto from 'crypto';

export class TransferId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(value?: string | TransferId): TransferId {
    if (value instanceof TransferId) {
      return value;
    }
    const id = value && value.trim().length > 0 ? value.trim() : crypto.randomUUID();
    return new TransferId(id);
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other?: TransferId): boolean {
    if (!other) return false;
    return this.value === other.getValue();
  }
}
