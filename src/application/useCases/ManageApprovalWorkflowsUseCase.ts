import { randomUUID } from 'crypto';

import { prisma } from '../../infrastructure/database/prisma';


export class ManageApprovalWorkflowsUseCase {
  
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

  async listPendingRequests(tenantId: string): Promise<any> {
    return await prisma.approvalRequestModel.findMany({
      where: { tenantId, status: 'PENDING' },
      include: {
        workflow: true,
        decisions: true
      },
      orderBy: { createdAt: 'desc' }
    });
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
      where: { id: requestId, tenantId },
      include: { workflow: true, decisions: true }
    });
    
    if (!req) throw new Error("Approval request not found");
    if (req.status !== 'PENDING') throw new Error("Approval request is not pending");

    const newDecision = await prisma.approvalDecisionModel.create({
      data: {
        id: randomUUID(),
        requestId,
        stepIndex: req.currentStep,
        deciderId,
        decision,
        notes: notes || null
      }
    });

    if (decision === 'REJECT') {
      await prisma.approvalRequestModel.update({
        where: { id: requestId },
        data: { status: 'REJECTED' }
      });
    } else if (decision === 'APPROVE') {
      await prisma.approvalRequestModel.update({
        where: { id: requestId },
        data: { status: 'APPROVED' }
      });
    }

    return newDecision;
  }
}
