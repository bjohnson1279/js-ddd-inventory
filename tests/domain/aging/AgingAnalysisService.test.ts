import { AgingAnalysisService } from '../../../src/domain/aging/AgingAnalysisService';
import { DeadStockDetector } from '../../../src/domain/aging/DeadStockDetector';

describe('AgingAnalysisService', () => {
  let service: AgingAnalysisService;
  let detector: DeadStockDetector;

  beforeEach(() => {
    service = new AgingAnalysisService();
    detector = new DeadStockDetector();
  });

  it('groups items into correct aging buckets', () => {
    const now = new Date('2026-08-30');
    const layers = [
      { variantId: 'SKU1', remainingQuantity: 10, unitCostCents: 100, receivedAt: new Date('2026-08-15') }, // 15 days -> 0-30d
      { variantId: 'SKU2', remainingQuantity: 5, unitCostCents: 200, receivedAt: new Date('2026-07-15') }, // 46 days -> 31-60d
      { variantId: 'SKU3', remainingQuantity: 2, unitCostCents: 500, receivedAt: new Date('2025-01-01') }  // >180 days -> 180d+
    ];

    const report = service.generateAgingReport(layers, now);
    
    expect(report.buckets.length).toBe(3);
    expect(report.buckets.find(b => b.bucket === '0-30d')?.quantity).toBe(10);
    expect(report.buckets.find(b => b.bucket === '31-60d')?.quantity).toBe(5);
    expect(report.buckets.find(b => b.bucket === '180d+')?.quantity).toBe(2);
  });

  it('identifies dead stock correctly', () => {
    const inventorySkus = ['SKU1', 'SKU2', 'SKU3'];
    const dispatches = [{ sku: 'SKU2' }];
    
    const deadStock = detector.identifyDeadStock(inventorySkus, dispatches);
    expect(deadStock).toEqual(['SKU1', 'SKU3']);
  });
});
