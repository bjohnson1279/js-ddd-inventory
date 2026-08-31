import { v4 as uuidv4 } from 'uuid';

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
      uuidv4(),
      tenantId,
      name,
      baseCurrency,
      taxIdentifier,
      new Date()
    );
  }
}
