import * as crypto from 'crypto';

export class RecommendationId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(value?: string): RecommendationId {
    const id = value && value.trim().length > 0 ? value.trim() : crypto.randomUUID();
    return new RecommendationId(id);
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other?: RecommendationId): boolean {
    if (!other) return false;
    return this.value === other.getValue();
  }
}
