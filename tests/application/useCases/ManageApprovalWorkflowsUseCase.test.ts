import { ManageApprovalWorkflowsUseCase } from '../../../src/application/useCases/ManageApprovalWorkflowsUseCase';

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
  pool: {
    query: jest.fn(),
    end: jest.fn(),
  }
}));

jest.mock('crypto', () => ({
  randomUUID: () => 'test-uuid',
}));

import { prisma } from '../../../src/infrastructure/database/prisma';

describe('ManageApprovalWorkflowsUseCase', () => {
  let useCase: ManageApprovalWorkflowsUseCase;
  const tenantId = 'tenant-1';

  beforeEach(() => {
    useCase = new ManageApprovalWorkflowsUseCase();
    jest.clearAllMocks();
  });

  describe('listWorkflows', () => {
    it('should list workflows for a tenant', async () => {
      const mockWorkflows = [{ id: 'wf-1' }];
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
    it('should create a workflow with object config', async () => {
      const data = { name: 'wf-name', triggerEvent: 'event-1', config: { key: 'val' }, isActive: false };
      (prisma.approvalWorkflowModel.create as jest.Mock).mockResolvedValue({ id: 'new-wf' });

      const result = await useCase.createWorkflow(tenantId, data);

      expect(prisma.approvalWorkflowModel.create).toHaveBeenCalledWith({
        data: {
          id: 'test-uuid',
          tenantId,
          name: data.name,
          triggerEvent: data.triggerEvent,
          config: JSON.stringify(data.config),
          isActive: false,
        },
      });
      expect(result).toEqual({ id: 'new-wf' });
    });

    it('should create a workflow with string config and default isActive', async () => {
      const data = { name: 'wf-name', triggerEvent: 'event-1', config: '{"key":"val"}' };
      (prisma.approvalWorkflowModel.create as jest.Mock).mockResolvedValue({ id: 'new-wf' });

      const result = await useCase.createWorkflow(tenantId, data);

      expect(prisma.approvalWorkflowModel.create).toHaveBeenCalledWith({
        data: {
          id: 'test-uuid',
          tenantId,
          name: data.name,
          triggerEvent: data.triggerEvent,
          config: data.config,
          isActive: true,
        },
      });
    });
  });

  describe('updateWorkflow', () => {
    it('should update workflow with config string', async () => {
      const workflowId = 'wf-1';
      const config = '{"key":"val2"}';
      (prisma.approvalWorkflowModel.update as jest.Mock).mockResolvedValue({ id: workflowId });

      const result = await useCase.updateWorkflow(tenantId, workflowId, config);

      expect(prisma.approvalWorkflowModel.update).toHaveBeenCalledWith({
        where: { id: workflowId },
        data: { config },
      });
      expect(result).toEqual({ id: workflowId });
    });

    it('should update workflow with config object', async () => {
      const workflowId = 'wf-1';
      const config = { key: 'val2' };
      (prisma.approvalWorkflowModel.update as jest.Mock).mockResolvedValue({ id: workflowId });

      const result = await useCase.updateWorkflow(tenantId, workflowId, config);

      expect(prisma.approvalWorkflowModel.update).toHaveBeenCalledWith({
        where: { id: workflowId },
        data: { config: JSON.stringify(config) },
      });
    });
  });

  describe('toggleWorkflow', () => {
    it('should toggle workflow isActive flag', async () => {
      const workflowId = 'wf-1';
      (prisma.approvalWorkflowModel.findUnique as jest.Mock).mockResolvedValue({ id: workflowId, isActive: true });
      (prisma.approvalWorkflowModel.update as jest.Mock).mockResolvedValue({ id: workflowId, isActive: false });

      const result = await useCase.toggleWorkflow(tenantId, workflowId);

      expect(prisma.approvalWorkflowModel.findUnique).toHaveBeenCalledWith({ where: { id: workflowId } });
      expect(prisma.approvalWorkflowModel.update).toHaveBeenCalledWith({
        where: { id: workflowId },
        data: { isActive: false },
      });
      expect(result).toEqual({ id: workflowId, isActive: false });
    });

    it('should throw an error if workflow is not found', async () => {
      const workflowId = 'wf-1';
      (prisma.approvalWorkflowModel.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(useCase.toggleWorkflow(tenantId, workflowId)).rejects.toThrow("Workflow not found");
    });
  });

  describe('listPendingRequests', () => {
    it('should list pending requests', async () => {
      const mockRequests = [{ id: 'req-1' }];
      (prisma.approvalRequestModel.findMany as jest.Mock).mockResolvedValue(mockRequests);

      const result = await useCase.listPendingRequests(tenantId);

      expect(prisma.approvalRequestModel.findMany).toHaveBeenCalledWith({
        where: { tenantId, status: 'PENDING' },
        include: { workflow: true, decisions: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockRequests);
    });
  });

  describe('getApprovalRequest', () => {
    it('should get an approval request', async () => {
      const requestId = 'req-1';
      const mockRequest = { id: requestId };
      (prisma.approvalRequestModel.findFirst as jest.Mock).mockResolvedValue(mockRequest);

      const result = await useCase.getApprovalRequest(tenantId, requestId);

      expect(prisma.approvalRequestModel.findFirst).toHaveBeenCalledWith({
        where: { id: requestId, tenantId },
        include: { workflow: true, decisions: true },
      });
      expect(result).toEqual(mockRequest);
    });
  });

  describe('submitDecision', () => {
    it('should submit an APPROVE decision', async () => {
      const requestId = 'req-1';
      const mockRequest = { id: requestId, status: 'PENDING', currentStep: 1 };
      (prisma.approvalRequestModel.findFirst as jest.Mock).mockResolvedValue(mockRequest);
      (prisma.approvalDecisionModel.create as jest.Mock).mockResolvedValue({ id: 'dec-1' });

      const result = await useCase.submitDecision(tenantId, requestId, 'decider-1', 'APPROVE', 'Looks good');

      expect(prisma.approvalDecisionModel.create).toHaveBeenCalledWith({
        data: {
          id: 'test-uuid',
          requestId,
          stepIndex: 1,
          deciderId: 'decider-1',
          decision: 'APPROVE',
          notes: 'Looks good',
        },
      });
      expect(prisma.approvalRequestModel.update).toHaveBeenCalledWith({
        where: { id: requestId },
        data: { status: 'APPROVED' },
      });
      expect(result).toEqual({ id: 'dec-1' });
    });

    it('should submit a REJECT decision', async () => {
      const requestId = 'req-1';
      const mockRequest = { id: requestId, status: 'PENDING', currentStep: 1 };
      (prisma.approvalRequestModel.findFirst as jest.Mock).mockResolvedValue(mockRequest);
      (prisma.approvalDecisionModel.create as jest.Mock).mockResolvedValue({ id: 'dec-1' });

      await useCase.submitDecision(tenantId, requestId, 'decider-1', 'REJECT');

      expect(prisma.approvalRequestModel.update).toHaveBeenCalledWith({
        where: { id: requestId },
        data: { status: 'REJECTED' },
      });
    });

    it('should throw if request not found', async () => {
      (prisma.approvalRequestModel.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(useCase.submitDecision(tenantId, 'req-1', 'decider-1', 'APPROVE')).rejects.toThrow("Approval request not found");
    });

    it('should throw if request is not pending', async () => {
      const mockRequest = { id: 'req-1', status: 'APPROVED' };
      (prisma.approvalRequestModel.findFirst as jest.Mock).mockResolvedValue(mockRequest);

      await expect(useCase.submitDecision(tenantId, 'req-1', 'decider-1', 'APPROVE')).rejects.toThrow("Approval request is not pending");
    });
  });
});
