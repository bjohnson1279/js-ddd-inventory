import { LegalEntity } from '../../../../src/domain/accounting/aggregates/LegalEntity';

describe('LegalEntity Aggregate', () => {
  it('should instantiate a LegalEntity correctly via constructor', () => {
    const now = new Date();
    const entity = new LegalEntity(
      'le-123',
      'tenant-456',
      'Acme Corp',
      'USD',
      'TAX-789',
      now
    );

    expect(entity.id).toBe('le-123');
    expect(entity.tenantId).toBe('tenant-456');
    expect(entity.name).toBe('Acme Corp');
    expect(entity.baseCurrency).toBe('USD');
    expect(entity.taxIdentifier).toBe('TAX-789');
    expect(entity.createdAt).toBe(now);
  });

  it('should create a LegalEntity using the static create factory method', () => {
    const entity = LegalEntity.create('tenant-1', 'Global Ltd', 'EUR', 'VAT-123');

    expect(entity.id).toBeDefined();
    expect(typeof entity.id).toBe('string');
    expect(entity.tenantId).toBe('tenant-1');
    expect(entity.name).toBe('Global Ltd');
    expect(entity.baseCurrency).toBe('EUR');
    expect(entity.taxIdentifier).toBe('VAT-123');
    expect(entity.createdAt).toBeInstanceOf(Date);
  });

  it('should default taxIdentifier to null when not provided to LegalEntity.create', () => {
    const entity = LegalEntity.create('tenant-2', 'Local Inc', 'GBP');

    expect(entity.taxIdentifier).toBeNull();
  });
});
