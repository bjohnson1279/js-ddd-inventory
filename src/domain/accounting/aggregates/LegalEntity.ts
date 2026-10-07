import { randomUUID } from 'node:crypto';

export class LegalEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly name: string,
    public readonly baseCurrency: string,
    public readonly taxIdentifier: string | null,
    public readonly createdAt: Date
  ) {}

  public static create(
    tenantId: string,
    name: string,
    baseCurrency: string,
    taxIdentifier: string | null = null
  ): LegalEntity {
    return new LegalEntity(
      randomUUID(),
      tenantId,
      name,
      baseCurrency,
      taxIdentifier,
      new Date()
    );
  }
}
