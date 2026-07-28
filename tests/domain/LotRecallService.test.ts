import { LotBatch } from '../../src/domain/procurement/entities/LotBatch';
import { LotRecallService } from '../../src/domain/procurement/services/LotRecallService';
import { CrossDockingEngine } from '../../src/domain/shipping/services/CrossDockingEngine';

describe('Lot Recall & Cross-Docking Engine (JS REST backend)', () => {
  it('should filter out expired or non-active lot batches', () => {
    const activeLot = new LotBatch('lot-1', 'tenant-1', 'LOT-A', 'VAR-1', 'ACTIVE');
    expect(activeLot.isAvailable()).toBe(true);

    const expiredLot = new LotBatch(
      'lot-2',
      'tenant-1',
      'LOT-B',
      'VAR-1',
      'ACTIVE',
      undefined,
      new Date(Date.now() - 10000)
    );
    expect(expiredLot.isAvailable()).toBe(false);
  });

  it('should compute lot traceability impact report', () => {
    const lot = new LotBatch('lot-1', 'tenant-1', 'LOT-A', 'VAR-1', 'RECALLED');
    const layers = [{ id: 'cl-1', remainingQuantity: 0, originalQuantity: 10 }];
    const shipments = [
      { id: 'SHIP-1', sku: 'VAR-1', destinationAddress: '123 Main St', quantity: 10 }
    ];

    const report = LotRecallService.generateTraceabilityReport(lot, layers, shipments);
    expect(report.lotNumber).toBe('LOT-A');
    expect(report.affectedOrders.length).toBe(1);
    expect(report.affectedCustomers).toContain('123 Main St');
  });

  it('should assign cross-docking quantities by priority', () => {
    const opportunities = CrossDockingEngine.evaluate(
      'PO-10',
      [{ variantId: 'V1', quantity: 20 }],
      [{ orderId: 'O1', variantId: 'V1', quantity: 15, priority: 5 }]
    );
    expect(opportunities.length).toBe(1);
    expect(opportunities[0].recommendedCrossDockQuantity).toBe(15);
  });
});
