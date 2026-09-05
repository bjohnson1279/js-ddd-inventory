import { ManageApprovalWorkflowsUseCase } from '../../../src/application/useCases/ManageApprovalWorkflowsUseCase';
import { prisma } from '../../../src/infrastructure/database/prisma';

jest.mock('../../../src/infrastructure/database/prisma', () => ({
  prisma: {
    approvalWorkflowModel: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    approvalRequestModel: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    approvalDecisionModel: {
      create: jest.fn(),
    },
  },
}));

describe('ManageApprovalWorkflowsUseCase', () => {
  let useCase: ManageApprovalWorkflowsUseCase;

  beforeEach(() => {
    useCase = new ManageApprovalWorkflowsUseCase();
    jest.clearAllMocks();
  });

  describe('listWorkflows', () => {
    it('should list workflows for a tenant ordered by createdAt desc', async () => {
      const tenantId = 'tenant-1';
      const mockWorkflows = [{ id: 'wf-1', name: 'WF 1' }];
      (prisma.approvalWorkflowModel.findMany as jest.Mock).mockResolvedValue(mockWorkflows);

      const result = await useCase.listWorkflows(tenantId);

      expect(prisma.approvalWorkflowModel.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockWorkflows);
    });
  });

  describe('createWorkflow', () => {
    it('should create a new workflow', async () => {
      const tenantId = 'tenant-1';
      const data = {
        name: 'New WF',
        triggerEvent: 'ON_PURCHASE',
        config: { steps: [] },
        isActive: true,
      };

      const mockCreated = { id: 'new-id', ...data };
      (prisma.approvalWorkflowModel.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await useCase.createWorkflow(tenantId, data);

      expect(prisma.approvalWorkflowModel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          name: data.name,
          triggerEvent: data.triggerEvent,
          config: JSON.stringify(data.config),
          isActive: true,
        }),
      });
      expect(result).toEqual(mockCreated);
    });

    it('should handle stringified config and undefined isActive', async () => {
      const tenantId = 'tenant-1';
      const data = {
        name: 'New WF',
        triggerEvent: 'ON_PURCHASE',
        config: '{"steps":[]}',
      };

      await useCase.createWorkflow(tenantId, data);

      expect(prisma.approvalWorkflowModel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          config: data.config,
          isActive: true,
        }),
      });
    });
  });

  describe('updateWorkflow', () => {
    it('should update a workflow config (object)', async () => {
      const tenantId = 'tenant-1';
      const workflowId = 'wf-1';
      const config = { steps: ['step1'] };

      await useCase.updateWorkflow(tenantId, workflowId, config);

      expect(prisma.approvalWorkflowModel.update).toHaveBeenCalledWith({
        where: { id: workflowId },
        data: { config: JSON.stringify(config) },
      });
    });

    it('should update a workflow config (string)', async () => {
      const tenantId = 'tenant-1';
      const workflowId = 'wf-1';
      const configStr = '{"steps":["step1"]}';

      await useCase.updateWorkflow(tenantId, workflowId, configStr);

      expect(prisma.approvalWorkflowModel.update).toHaveBeenCalledWith({
        where: { id: workflowId },
        data: { config: configStr },
      });
    });
  });

  describe('toggleWorkflow', () => {
    it('should throw an error if workflow is not found', async () => {
      (prisma.approvalWorkflowModel.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(useCase.toggleWorkflow('tenant-1', 'wf-1'))
        .rejects
        .toThrow('Workflow not found');
    });

    it('should toggle workflow isActive status', async () => {
      (prisma.approvalWorkflowModel.findUnique as jest.Mock).mockResolvedValue({ id: 'wf-1', isActive: true });

      await useCase.toggleWorkflow('tenant-1', 'wf-1');

      expect(prisma.approvalWorkflowModel.update).toHaveBeenCalledWith({
        where: { id: 'wf-1' },
        data: { isActive: false },
      });
    });
  });

  describe('listPendingRequests', () => {
    it('should list pending requests', async () => {
      const tenantId = 'tenant-1';
      const mockReqs = [{ id: 'req-1' }];
      (prisma.approvalRequestModel.findMany as jest.Mock).mockResolvedValue(mockReqs);

      const result = await useCase.listPendingRequests(tenantId);

      expect(prisma.approvalRequestModel.findMany).toHaveBeenCalledWith({
        where: { tenantId, status: 'PENDING' },
        include: {
          workflow: true,
          decisions: true
        },
        orderBy: { createdAt: 'desc' }
      });
      expect(result).toEqual(mockReqs);
    });
  });

  describe('getApprovalRequest', () => {
    it('should get a specific approval request', async () => {
      const tenantId = 'tenant-1';
      const requestId = 'req-1';
      const mockReq = { id: requestId };
      (prisma.approvalRequestModel.findFirst as jest.Mock).mockResolvedValue(mockReq);

      const result = await useCase.getApprovalRequest(tenantId, requestId);

      expect(prisma.approvalRequestModel.findFirst).toHaveBeenCalledWith({
        where: { id: requestId, tenantId },
        include: {
          workflow: true,
          decisions: true
        }
      });
      expect(result).toEqual(mockReq);
    });
  });

  describe('submitDecision', () => {
    it('should throw error if request not found', async () => {
      (prisma.approvalRequestModel.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(useCase.submitDecision('tenant-1', 'req-1', 'user-1', 'APPROVE'))
        .rejects
        .toThrow('Approval request not found');
    });

    it('should throw error if request is not pending', async () => {
      (prisma.approvalRequestModel.findFirst as jest.Mock).mockResolvedValue({ status: 'APPROVED' });

      await expect(useCase.submitDecision('tenant-1', 'req-1', 'user-1', 'APPROVE'))
        .rejects
        .toThrow('Approval request is not pending');
    });

    it('should process APPROVE decision', async () => {
      (prisma.approvalRequestModel.findFirst as jest.Mock).mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
        currentStep: 1
      });
      const mockDecision = { id: 'dec-1' };
      (prisma.approvalDecisionModel.create as jest.Mock).mockResolvedValue(mockDecision);

      const result = await useCase.submitDecision('tenant-1', 'req-1', 'user-1', 'APPROVE', 'Looks good');

      expect(prisma.approvalDecisionModel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          requestId: 'req-1',
          stepIndex: 1,
          deciderId: 'user-1',
          decision: 'APPROVE',
          notes: 'Looks good'
        })
      });

      expect(prisma.approvalRequestModel.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'APPROVED' }
      });

      expect(result).toEqual(mockDecision);
    });

    it('should process REJECT decision', async () => {
      (prisma.approvalRequestModel.findFirst as jest.Mock).mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
        currentStep: 1
      });
      const mockDecision = { id: 'dec-1' };
      (prisma.approvalDecisionModel.create as jest.Mock).mockResolvedValue(mockDecision);

      const result = await useCase.submitDecision('tenant-1', 'req-1', 'user-1', 'REJECT');

      expect(prisma.approvalDecisionModel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          requestId: 'req-1',
          stepIndex: 1,
          deciderId: 'user-1',
          decision: 'REJECT',
          notes: null
        })
      });

      expect(prisma.approvalRequestModel.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'REJECTED' }
      });

      expect(result).toEqual(mockDecision);
    });
  });
});
