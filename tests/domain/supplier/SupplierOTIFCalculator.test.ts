import { SupplierOTIFCalculator } from '../../../src/domain/supplier/SupplierOTIFCalculator';
import { ASN } from '../../../src/domain/supplier/ASN';

describe('SupplierOTIFCalculator', () => {
  let calculator: SupplierOTIFCalculator;

  beforeEach(() => {
    calculator = new SupplierOTIFCalculator();
  });

  it('calculates 100% OTIF when all ASNs are on time', () => {
    const asns: ASN[] = [
      { id: '1', asnNumber: 'A1', supplierId: 'S1', expectedDelivery: new Date('2026-08-01'), actualDelivery: new Date('2026-08-01'), status: 'DELIVERED', createdAt: new Date() }
    ];
    const result = calculator.calculateOTIF(asns);
    expect(result.onTimeRate).toBe(100);
  });

  it('calculates 50% OTIF when half ASNs are late', () => {
    const asns: ASN[] = [
      { id: '1', asnNumber: 'A1', supplierId: 'S1', expectedDelivery: new Date('2026-08-01'), actualDelivery: new Date('2026-08-01'), status: 'DELIVERED', createdAt: new Date() },
      { id: '2', asnNumber: 'A2', supplierId: 'S1', expectedDelivery: new Date('2026-08-01'), actualDelivery: new Date('2026-08-02'), status: 'DELIVERED', createdAt: new Date() }
    ];
    const result = calculator.calculateOTIF(asns);
    expect(result.onTimeRate).toBe(50);
  });
});
