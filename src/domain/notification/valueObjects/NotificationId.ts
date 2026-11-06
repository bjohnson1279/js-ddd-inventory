import * as crypto from 'crypto';

export class NotificationId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(value?: string | NotificationId): NotificationId {
    if (value instanceof NotificationId) {
      return value;
    }
    const id = value && value.trim().length > 0 ? value.trim() : crypto.randomUUID();
    return new NotificationId(id);
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other?: NotificationId): boolean {
    if (!other) return false;
    return this.value === other.getValue();
  }
}
