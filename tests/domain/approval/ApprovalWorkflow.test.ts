import { ApprovalWorkflow, ApprovalWorkflowConfig } from '../../../src/domain/approval/ApprovalWorkflow';

describe('ApprovalWorkflow Entity', () => {
  const defaultConfig: ApprovalWorkflowConfig = {
    thresholds: [],
    steps: [
      {
        approverRoles: ['admin'],
        requiredCount: 1,
        timeoutHours: 24
      }
    ]
  };

  describe('Constructor', () => {
    it('Constructor throws when triggerEvent is empty', () => {
      expect(() => {
        new ApprovalWorkflow('id', 'tenant', 'name', '', true, defaultConfig);
      }).toThrow('Approval workflow trigger event cannot be empty.');
      
      expect(() => {
        new ApprovalWorkflow('id', 'tenant', 'name', '   ', true, defaultConfig);
      }).toThrow('Approval workflow trigger event cannot be empty.');
    });

    it('Constructor throws when steps array is empty', () => {
      expect(() => {
        new ApprovalWorkflow('id', 'tenant', 'name', 'trigger', true, { thresholds: [], steps: [] });
      }).toThrow('Approval workflow must define at least one approval step.');
    });
  });

  describe('shouldTrigger', () => {
    it('shouldTrigger returns true when thresholds array is empty (always trigger)', () => {
      const workflow = new ApprovalWorkflow('id', 'tenant', 'name', 'trigger', true, defaultConfig);
      expect(workflow.shouldTrigger({ anyField: 123 })).toBe(true);
    });

    it('shouldTrigger returns false when workflow is inactive', () => {
      const workflow = new ApprovalWorkflow('id', 'tenant', 'name', 'trigger', false, defaultConfig);
      expect(workflow.shouldTrigger({})).toBe(false);
    });

    it('shouldTrigger returns true when all threshold conditions met (>=, >, <=, <, ==, !=)', () => {
      const config: ApprovalWorkflowConfig = {
        thresholds: [
          { field: 'f1', operator: '>=', value: 10 },
          { field: 'f2', operator: '>', value: 10 },
          { field: 'f3', operator: '<=', value: 10 },
          { field: 'f4', operator: '<', value: 10 },
          { field: 'f5', operator: '==', value: 10 },
          { field: 'f6', operator: '!=', value: 10 }
        ],
        steps: defaultConfig.steps
      };
      const workflow = new ApprovalWorkflow('id', 'tenant', 'name', 'trigger', true, config);
      expect(workflow.shouldTrigger({
        f1: 10,
        f2: 11,
        f3: 10,
        f4: 9,
        f5: 10,
        f6: 11
      })).toBe(true);
    });

    it('shouldTrigger returns false when any threshold condition fails', () => {
      const config: ApprovalWorkflowConfig = {
        thresholds: [
          { field: 'f1', operator: '>=', value: 10 },
          { field: 'f2', operator: '<=', value: 10 }
        ],
        steps: defaultConfig.steps
      };
      const workflow = new ApprovalWorkflow('id', 'tenant', 'name', 'trigger', true, config);
      expect(workflow.shouldTrigger({ f1: 10, f2: 11 })).toBe(false);
    });

    it('shouldTrigger returns false when payload field is null/undefined', () => {
      const config: ApprovalWorkflowConfig = {
        thresholds: [
          { field: 'f1', operator: '>=', value: 10 }
        ],
        steps: defaultConfig.steps
      };
      const workflow = new ApprovalWorkflow('id', 'tenant', 'name', 'trigger', true, config);
      expect(workflow.shouldTrigger({ f2: 10 })).toBe(false); // f1 is undefined
      expect(workflow.shouldTrigger({ f1: null })).toBe(false); // f1 is null
    });
  });

  describe('getStep', () => {
    it('getStep returns correct step config', () => {
      const config: ApprovalWorkflowConfig = {
        thresholds: [],
        steps: [
          { approverRoles: ['admin'], requiredCount: 1, timeoutHours: 24 },
          { approverRoles: ['manager'], requiredCount: 2, timeoutHours: 48 }
        ]
      };
      const workflow = new ApprovalWorkflow('id', 'tenant', 'name', 'trigger', true, config);
      expect(workflow.getStep(0)).toEqual(config.steps[0]);
      expect(workflow.getStep(1)).toEqual(config.steps[1]);
    });

    it('getStep returns undefined for out-of-bounds index', () => {
      const workflow = new ApprovalWorkflow('id', 'tenant', 'name', 'trigger', true, defaultConfig);
      expect(workflow.getStep(1)).toBeUndefined();
      expect(workflow.getStep(-1)).toBeUndefined();
    });
  });
});
