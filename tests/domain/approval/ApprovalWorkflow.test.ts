import { ApprovalWorkflow, ApprovalWorkflowConfig } from '../../../src/domain/approval/ApprovalWorkflow';

describe('ApprovalWorkflow', () => {
  const baseConfig: ApprovalWorkflowConfig = {
    thresholds: [],
    steps: [{ approverRoles: ['admin'], requiredCount: 1, timeoutHours: 24 }]
  };

  it('shouldTrigger true when thresholds empty', () => {
    const wf = new ApprovalWorkflow('1', 't1', 'Test', 'PO_CREATED', true, baseConfig);
    expect(wf.shouldTrigger({ totalValueCents: 100 })).toBe(true);
  });

  it('shouldTrigger false when inactive', () => {
    const wf = new ApprovalWorkflow('1', 't1', 'Test', 'PO_CREATED', false, baseConfig);
    expect(wf.shouldTrigger({ totalValueCents: 1000 })).toBe(false);
  });

  it('shouldTrigger true when all thresholds met', () => {
    const config: ApprovalWorkflowConfig = {
      thresholds: [
        { field: 'val1', operator: '>=', value: 10 },
        { field: 'val2', operator: '>', value: 5 },
        { field: 'val3', operator: '<=', value: 20 },
        { field: 'val4', operator: '<', value: 30 },
        { field: 'val5', operator: '==', value: 50 },
        { field: 'val6', operator: '!=', value: 0 }
      ],
      steps: [{ approverRoles: ['admin'], requiredCount: 1, timeoutHours: 24 }]
    };
    const wf = new ApprovalWorkflow('1', 't1', 'Test', 'PO_CREATED', true, config);
    expect(wf.shouldTrigger({
      val1: 10, val2: 6, val3: 20, val4: 29, val5: 50, val6: 1
    })).toBe(true);
  });

  it('shouldTrigger false when any threshold fails', () => {
    const config: ApprovalWorkflowConfig = {
      thresholds: [
        { field: 'val1', operator: '>=', value: 10 },
        { field: 'val2', operator: '>', value: 5 }
      ],
      steps: [{ approverRoles: ['admin'], requiredCount: 1, timeoutHours: 24 }]
    };
    const wf = new ApprovalWorkflow('1', 't1', 'Test', 'PO_CREATED', true, config);
    expect(wf.shouldTrigger({ val1: 10, val2: 5 })).toBe(false);
  });

  it('shouldTrigger false when payload field null', () => {
    const config: ApprovalWorkflowConfig = {
      thresholds: [{ field: 'val1', operator: '>=', value: 10 }],
      steps: [{ approverRoles: ['admin'], requiredCount: 1, timeoutHours: 24 }]
    };
    const wf = new ApprovalWorkflow('1', 't1', 'Test', 'PO_CREATED', true, config);
    expect(wf.shouldTrigger({ val1: null })).toBe(false);
    expect(wf.shouldTrigger({})).toBe(false);
  });

  it('Constructor throws on empty triggerEvent', () => {
    expect(() => new ApprovalWorkflow('1', 't1', 'Test', '', true, baseConfig))
      .toThrow('Approval workflow trigger event cannot be empty.');
  });

  it('Constructor throws on empty steps', () => {
    expect(() => new ApprovalWorkflow('1', 't1', 'Test', 'PO_CREATED', true, { thresholds: [], steps: [] }))
      .toThrow('Approval workflow must define at least one approval step.');
  });

  it('getStep returns correct config / undefined for out-of-bounds', () => {
    const wf = new ApprovalWorkflow('1', 't1', 'Test', 'PO_CREATED', true, baseConfig);
    expect(wf.getStep(0)).toBe(baseConfig.steps[0]);
    expect(wf.getStep(1)).toBeUndefined();
  });
});
