import * as crypto from 'crypto';

export class ApprovalRequestId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(value?: string | ApprovalRequestId): ApprovalRequestId {
    if (value instanceof ApprovalRequestId) {
      return value;
    }
    const id = value && value.trim().length > 0 ? value.trim() : crypto.randomUUID();
    return new ApprovalRequestId(id);
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other?: ApprovalRequestId): boolean {
    if (!other) return false;
    return this.value === other.getValue();
  }
}
