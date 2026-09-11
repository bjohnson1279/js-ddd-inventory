import { ApprovalWorkflowService } from '../../../src/domain/approval/ApprovalWorkflowService';
import { ApprovalRequestStatus } from '../../../src/domain/approval/ApprovalRequest';

describe('ApprovalWorkflowService', () => {
  let prismaMock: any;
  let service: ApprovalWorkflowService;
  let dispatcherMock: any;

  beforeEach(() => {
    prismaMock = {
      approvalWorkflowModel: { findFirst: jest.fn() },
      approvalRequestModel: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      approvalDecisionModel: { create: jest.fn() },
      $transaction: jest.fn(async (ops) => { for (const op of ops) await op; })
    };
    dispatcherMock = { dispatch: jest.fn() };
    service = new ApprovalWorkflowService(prismaMock, dispatcherMock);
  });

  describe('evaluateAndIntercept', () => {
    it('returns intercepted:false when no workflow', async () => {
      prismaMock.approvalWorkflowModel.findFirst.mockResolvedValue(null);
      const res = await service.evaluateAndIntercept('t1', 'evt', 'Type', 'ref1', 'req1', {});
      expect(res.intercepted).toBe(false);
    });

    it('returns intercepted:false when inactive', async () => {
      prismaMock.approvalWorkflowModel.findFirst.mockResolvedValue({ isActive: false });
      const res = await service.evaluateAndIntercept('t1', 'evt', 'Type', 'ref1', 'req1', {});
      expect(res.intercepted).toBe(false);
    });

    it('returns intercepted:false when thresholds not met', async () => {
      prismaMock.approvalWorkflowModel.findFirst.mockResolvedValue({
        isActive: true,
        config: JSON.stringify({ thresholds: [{ field: 'v', operator: '>', value: 10 }], steps: [{ approverRoles: ['admin'], requiredCount: 1, timeoutHours: 1 }] })
      });
      const res = await service.evaluateAndIntercept('t1', 'evt', 'Type', 'ref1', 'req1', { v: 5 });
      expect(res.intercepted).toBe(false);
    });

    it('returns intercepted:true when thresholds met', async () => {
      prismaMock.approvalWorkflowModel.findFirst.mockResolvedValue({
        id: 'wf1', isActive: true, config: JSON.stringify({ thresholds: [], steps: [{ approverRoles: ['admin'], requiredCount: 1, timeoutHours: 1 }] })
      });
      const res = await service.evaluateAndIntercept('t1', 'evt', 'Type', 'ref1', 'req1', { v: 15 });
      expect(res.intercepted).toBe(true);
      expect(prismaMock.approvalRequestModel.create).toHaveBeenCalled();
    });
  });

  describe('processDecision', () => {
    const setupRequest = (status = 'PENDING', steps = 1, currentStep = 0) => {
      prismaMock.approvalRequestModel.findUnique.mockResolvedValue({
        id: 'req1', status, currentStep, payload: '{}',
        workflow: { config: JSON.stringify({ steps: Array(steps).fill({ approverRoles: ['admin'], requiredCount: 1, timeoutHours: 1 }) }) },
        decisions: []
      });
    };

    it('throws when not pending', async () => {
      setupRequest('APPROVED');
      await expect(service.processDecision('req1', 'd1', 'APPROVED')).rejects.toThrow();
    });

    it('throws when not found', async () => {
      prismaMock.approvalRequestModel.findUnique.mockResolvedValue(null);
      await expect(service.processDecision('req1', 'd1', 'APPROVED')).rejects.toThrow();
    });

    it('multi-step chain, approved event', async () => {
      setupRequest('PENDING', 2, 0);
      let res = await service.processDecision('req1', 'd1', 'APPROVED');
      expect(res.status).toBe(ApprovalRequestStatus.Pending);

      prismaMock.approvalRequestModel.findUnique.mockResolvedValue({
        id: 'req1', status: 'PENDING', currentStep: 1, payload: '{}',
        workflow: { config: JSON.stringify({ steps: Array(2).fill({ approverRoles: ['admin'], requiredCount: 1, timeoutHours: 1 }) }) },
        decisions: [{ id: 'd1', stepIndex: 0, decision: 'APPROVED', decidedAt: new Date() }]
      });

      res = await service.processDecision('req1', 'd2', 'APPROVED');
      expect(res.status).toBe(ApprovalRequestStatus.Approved);
      expect(dispatcherMock.dispatch).toHaveBeenCalled();
    });

    it('rejected event', async () => {
      setupRequest('PENDING', 1, 0);
      const res = await service.processDecision('req1', 'd1', 'REJECTED');
      expect(res.status).toBe(ApprovalRequestStatus.Rejected);
      expect(dispatcherMock.dispatch).toHaveBeenCalled();
    });
  });

  describe('checkExpiredRequests', () => {
    it('escalates stale requests', async () => {
      prismaMock.approvalRequestModel.findMany.mockResolvedValue([{
        id: 'req1', status: 'PENDING', currentStep: 0, payload: '{}',
        workflow: { config: JSON.stringify({ steps: [{ timeoutHours: 1 }] }) }
      }]);
      const count = await service.checkExpiredRequests();
      expect(count).toBe(1);
      expect(prismaMock.approvalRequestModel.update).toHaveBeenCalled();
    });
  });

  describe('listPendingRequests', () => {
    it('lists pending requests', async () => {
      prismaMock.approvalRequestModel.findMany.mockResolvedValue([{
        id: 'req1', status: 'PENDING', currentStep: 0, payload: '{}',
        workflow: { config: JSON.stringify({ steps: [{ approverRoles: ['admin'] }] }) }
      }]);
      const list = await service.listPendingRequests('t1', ['admin']);
      expect(list).toHaveLength(1);
    });
  });
});
