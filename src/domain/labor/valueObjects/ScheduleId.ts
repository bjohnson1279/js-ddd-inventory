import * as crypto from 'crypto';

export class ScheduleId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(value?: string | ScheduleId): ScheduleId {
    if (value instanceof ScheduleId) {
      return value;
    }
    const id = value && value.trim().length > 0 ? value.trim() : crypto.randomUUID();
    return new ScheduleId(id);
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other?: ScheduleId): boolean {
    if (!other) return false;
    return this.value === other.getValue();
  }
}
