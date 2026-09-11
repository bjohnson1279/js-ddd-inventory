import { randomUUID } from 'crypto';
import { prisma } from '../../infrastructure/database/prisma';
import { ApprovalWorkflowService } from '../../domain/approval/ApprovalWorkflowService';
import { ApprovalRequestStatus } from '../../domain/approval/ApprovalRequest';

export class ManageApprovalWorkflowsUseCase {
  constructor(private readonly workflowService: ApprovalWorkflowService) {}
  
  async listWorkflows(tenantId: string): Promise<any> {
    return await prisma.approvalWorkflowModel.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createWorkflow(tenantId: string, data: any): Promise<any> {
    return await prisma.approvalWorkflowModel.create({
      data: {
        id: randomUUID(),
        tenantId,
        name: data.name,
        triggerEvent: data.triggerEvent,
        config: typeof data.config === 'string' ? data.config : JSON.stringify(data.config || {}),
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });
  }

  async updateWorkflow(tenantId: string, workflowId: string, config: any): Promise<any> {
    const configStr = typeof config === 'string' ? config : JSON.stringify(config);
    return await prisma.approvalWorkflowModel.update({
      where: { id: workflowId },
      data: { config: configStr }
    });
  }

  async toggleWorkflow(tenantId: string, workflowId: string): Promise<any> {
    const wf = await prisma.approvalWorkflowModel.findUnique({ where: { id: workflowId } });
    if (!wf) throw new Error("Workflow not found");
    
    return await prisma.approvalWorkflowModel.update({
      where: { id: workflowId },
      data: { isActive: !wf.isActive }
    });
  }

  async listPendingRequests(tenantId: string, deciderRoleIds?: string[]): Promise<any> {
    return await this.workflowService.listPendingRequests(tenantId, deciderRoleIds);
  }

  async getApprovalRequest(tenantId: string, requestId: string): Promise<any> {
    return await prisma.approvalRequestModel.findFirst({
      where: { id: requestId, tenantId },
      include: {
        workflow: true,
        decisions: true
      }
    });
  }

  async submitDecision(tenantId: string, requestId: string, deciderId: string, decision: string, notes?: string): Promise<any> {
    const req = await prisma.approvalRequestModel.findFirst({
      where: { id: requestId, tenantId }
    });
    if (!req) throw new Error("Approval request not found");
    
    let domainDecision: 'APPROVED' | 'REJECTED';
    if (decision === 'APPROVE') domainDecision = 'APPROVED';
    else if (decision === 'REJECT') domainDecision = 'REJECTED';
    else domainDecision = decision as any;

    const result = await this.workflowService.processDecision(requestId, deciderId, domainDecision, notes);
    return result;
  }
}
