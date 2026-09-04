import { ApprovalWorkflowService } from '../../../src/domain/approval/ApprovalWorkflowService';
import { PrismaClient } from '@prisma/client';
import { DomainEventDispatcher } from '../../../src/domain/events/DomainEventDispatcher';
import { ApprovalRequestApprovedEvent, ApprovalRequestRejectedEvent } from '../../../src/domain/approval/ApprovalEvents';

jest.mock('../../../src/domain/events/DomainEventDispatcher');

describe('ApprovalWorkflowService', () => {
  let prismaMock: jest.Mocked<PrismaClient>;
  let service: ApprovalWorkflowService;

  beforeEach(() => {
    prismaMock = {
      approvalWorkflowModel: {
        findFirst: jest.fn(),
      },
      approvalRequestModel: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      approvalDecisionModel: {
        create: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    } as unknown as jest.Mocked<PrismaClient>;

    service = new ApprovalWorkflowService(prismaMock);
    jest.clearAllMocks();
  });

  describe('evaluateAndIntercept', () => {
    it('evaluateAndIntercept returns { intercepted: false } when no workflow exists', async () => {
      (prismaMock.approvalWorkflowModel.findFirst as jest.Mock).mockResolvedValue(null);
      const result = await service.evaluateAndIntercept('tenant', 'event', 'ref', 'refId', 'req', {});
      expect(result.intercepted).toBe(false);
    });

    it('evaluateAndIntercept returns { intercepted: false } when workflow is inactive', async () => {
      (prismaMock.approvalWorkflowModel.findFirst as jest.Mock).mockResolvedValue({ isActive: false });
      const result = await service.evaluateAndIntercept('tenant', 'event', 'ref', 'refId', 'req', {});
      expect(result.intercepted).toBe(false);
    });

    it('evaluateAndIntercept returns { intercepted: false } when thresholds not met', async () => {
      (prismaMock.approvalWorkflowModel.findFirst as jest.Mock).mockResolvedValue({
        id: 'wf-1',
        isActive: true,
        triggerEvent: 'event',
        config: {
          thresholds: [{ field: 'amount', operator: '>=', value: 100 }],
          steps: [{ approverRoles: ['admin'], requiredCount: 1, timeoutHours: 0 }]
        }
      });
      const result = await service.evaluateAndIntercept('tenant', 'event', 'ref', 'refId', 'req', { amount: 50 });
      expect(result.intercepted).toBe(false);
    });

    it('evaluateAndIntercept creates request and returns { intercepted: true } when matched', async () => {
      (prismaMock.approvalWorkflowModel.findFirst as jest.Mock).mockResolvedValue({
        id: 'wf-1',
        isActive: true,
        triggerEvent: 'event',
        config: {
          thresholds: [{ field: 'amount', operator: '>=', value: 100 }],
          steps: [{ approverRoles: ['admin'], requiredCount: 1, timeoutHours: 24 }]
        }
      });
      (prismaMock.approvalRequestModel.create as jest.Mock).mockResolvedValue({});

      const result = await service.evaluateAndIntercept('tenant', 'event', 'ref', 'refId', 'req', { amount: 150 });
      expect(result.intercepted).toBe(true);
      expect(result.requestId).toBeDefined();
      expect(prismaMock.approvalRequestModel.create).toHaveBeenCalled();
    });
  });

  describe('processDecision', () => {
    const mockRequestRecord = {
      id: 'req-1',
      tenantId: 'tenant-1',
      workflowId: 'wf-1',
      referenceType: 'PO',
      referenceId: 'po-1',
      requesterId: 'req-1',
      payload: JSON.stringify({ amount: 100 }),
      status: 'PENDING',
      currentStep: 0,
      decisions: [],
      workflow: {
        config: {
          thresholds: [],
          steps: [
            { approverRoles: ['admin'], requiredCount: 1, timeoutHours: 24 },
            { approverRoles: ['manager'], requiredCount: 1, timeoutHours: 24 }
          ]
        }
      }
    };

    it('processDecision throws when request not found', async () => {
      (prismaMock.approvalRequestModel.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.processDecision('req-1', 'decider', 'APPROVED'))
        .rejects.toThrow('Approval request req-1 not found.');
    });

    it('processDecision throws when request is not pending', async () => {
      (prismaMock.approvalRequestModel.findUnique as jest.Mock).mockResolvedValue({
        ...mockRequestRecord,
        status: 'APPROVED'
      });
      await expect(service.processDecision('req-1', 'decider', 'APPROVED'))
        .rejects.toThrow('Cannot approve request in status: APPROVED');
    });

    it('processDecision transitions through multi-step approval chain', async () => {
      (prismaMock.approvalRequestModel.findUnique as jest.Mock).mockResolvedValue(mockRequestRecord);
      const res1 = await service.processDecision('req-1', 'decider', 'APPROVED');
      expect(res1.status).toBe('PENDING'); // Advanced to step 1
      expect(prismaMock.approvalRequestModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currentStep: 1, status: 'PENDING' }) })
      );

      (prismaMock.approvalRequestModel.findUnique as jest.Mock).mockResolvedValue({
        ...mockRequestRecord,
        currentStep: 1,
        decisions: [{ id: 'd1', stepIndex: 0, deciderId: 'decider', decision: 'APPROVED', createdAt: new Date() }]
      });
      const res2 = await service.processDecision('req-1', 'decider', 'APPROVED');
      expect(res2.status).toBe('APPROVED'); // Completed all steps
      expect(prismaMock.approvalRequestModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currentStep: 1, status: 'APPROVED' }) })
      );
    });

    it('processDecision dispatches ApprovalRequestApprovedEvent on final approval', async () => {
      (prismaMock.approvalRequestModel.findUnique as jest.Mock).mockResolvedValue({
        ...mockRequestRecord,
        workflow: {
          config: { steps: [{ approverRoles: ['admin'], requiredCount: 1, timeoutHours: 24 }] }
        }
      });
      await service.processDecision('req-1', 'decider', 'APPROVED');
      expect(DomainEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(ApprovalRequestApprovedEvent)])
      );
    });

    it('processDecision dispatches ApprovalRequestRejectedEvent on rejection', async () => {
      (prismaMock.approvalRequestModel.findUnique as jest.Mock).mockResolvedValue(mockRequestRecord);
      await service.processDecision('req-1', 'decider', 'REJECTED');
      expect(DomainEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(ApprovalRequestRejectedEvent)])
      );
    });
  });

  describe('checkExpiredRequests', () => {
    it('checkExpiredRequests escalates stale requests', async () => {
      (prismaMock.approvalRequestModel.findMany as jest.Mock).mockResolvedValue([{
        id: 'req-1',
        status: 'PENDING',
        currentStep: 0,
        payload: '{}',
        workflow: {
          config: { steps: [{}, {}] }
        }
      }]);
      const count = await service.checkExpiredRequests();
      expect(count).toBe(1);
      expect(prismaMock.approvalRequestModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currentStep: 1, status: 'ESCALATED' }) })
      );
    });

    it('checkExpiredRequests expires requests at final step', async () => {
      (prismaMock.approvalRequestModel.findMany as jest.Mock).mockResolvedValue([{
        id: 'req-1',
        status: 'PENDING',
        currentStep: 0,
        payload: '{}',
        workflow: {
          config: { steps: [{}] }
        }
      }]);
      const count = await service.checkExpiredRequests();
      expect(count).toBe(1);
      expect(prismaMock.approvalRequestModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'EXPIRED' }) })
      );
    });
  });

  describe('listPendingRequests', () => {
    it('listPendingRequests filters by decider roles', async () => {
      const mockReq = {
        id: 'req-1',
        status: 'PENDING',
        currentStep: 0,
        payload: '{}',
        workflow: {
          config: JSON.stringify({ steps: [{ approverRoles: ['admin'] }] })
        }
      };
      (prismaMock.approvalRequestModel.findMany as jest.Mock).mockResolvedValue([mockReq]);

      const resultWithMatch = await service.listPendingRequests('tenant', ['admin']);
      expect(resultWithMatch.length).toBe(1);

      const resultWithoutMatch = await service.listPendingRequests('tenant', ['user']);
      expect(resultWithoutMatch.length).toBe(0);
      
      const resultNoRoles = await service.listPendingRequests('tenant');
      expect(resultNoRoles.length).toBe(1);
    });
  });
});
