import { CycleCountScheduler } from '../../../src/domain/cycleCount/CycleCountScheduler';
import { CycleCountPlanModel } from '@prisma/client';

describe('CycleCountScheduler', () => {
  let scheduler: CycleCountScheduler;

  beforeEach(() => {
    scheduler = new CycleCountScheduler();
  });

  it('should generate audits for active plans due for cycle count', () => {
    const plans: CycleCountPlanModel[] = [
      {
        id: 'plan-1',
        tenantId: 'tenant-1',
        name: 'Weekly Plan A',
        abcClassification: 'A',
        frequencyDays: 7,
        zone: 'Zone-1',
        isActive: true,
        createdAt: new Date(),
      },
      {
        id: 'plan-2',
        tenantId: 'tenant-1',
        name: 'Monthly Plan B',
        abcClassification: 'B',
        frequencyDays: 30,
        zone: null,
        isActive: true,
        createdAt: new Date(),
      },
    ];

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600 * 1000);
    const lastCountDates = {
      'plan-1': tenDaysAgo, // 10 days since last count >= 7 days frequency -> due
      'plan-2': tenDaysAgo, // 10 days since last count < 30 days frequency -> not due
    };

    const audits = scheduler.generateAudits(plans, lastCountDates);

    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      tenantId: 'tenant-1',
      name: 'Audit based on Weekly Plan A',
      status: 'PENDING',
      abcClass: 'A',
      zone: 'Zone-1',
      isBlindCount: true,
    });
    expect(audits[0].id).toBeDefined();
    expect(typeof audits[0].id).toBe('string');
    // Verify valid UUID string format
    expect(audits[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
