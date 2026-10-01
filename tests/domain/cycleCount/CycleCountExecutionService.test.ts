import { CycleCountExecutionService, CycleCountLineItem } from '../../../src/domain/cycleCount/CycleCountExecutionService';

describe('CycleCountExecutionService', () => {
  it('should return true and mark items as MATCHED if counts match perfectly', () => {
    const service = new CycleCountExecutionService();
    const items: CycleCountLineItem[] = [
      { id: '1', cycleCountId: 'cc-1', sku: 'A', expectedQuantity: 10, status: 'PENDING' }
    ];
    
    const submissions = [{ sku: 'A', countedQuantity: 10 }];
    const success = service.processSubmission(items, submissions);
    
    expect(success).toBe(true);
    expect(items[0].status).toBe('MATCHED');
    expect(items[0].varianceQuantity).toBe(0);
  });

  it('should flag recount and return false if variance exceeds threshold', () => {
    const service = new CycleCountExecutionService();
    const items: CycleCountLineItem[] = [
      { id: '1', cycleCountId: 'cc-1', sku: 'A', expectedQuantity: 100, status: 'PENDING' }
    ];
    
    const submissions = [{ sku: 'A', countedQuantity: 90 }];
    const success = service.processSubmission(items, submissions);
    
    expect(success).toBe(false);
    expect(items[0].status).toBe('VARIANCE_FLAGGED');
    expect(items[0].varianceQuantity).toBe(-10);
  });
});
