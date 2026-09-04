/**
 * ApprovalWorkflowService
 *
 * Orchestration service that:
 * 1. Evaluates whether a domain action should be intercepted by an approval workflow
 * 2. Creates approval requests when thresholds are met
 * 3. Processes approval/rejection decisions and advances the workflow
 * 4. Handles escalation and expiration of stale requests
 */
import { PrismaClient } from '@prisma/client';
import { ApprovalWorkflow, ApprovalWorkflowConfig } from './ApprovalWorkflow';
import { ApprovalRequest, ApprovalRequestStatus, ApprovalDecisionRecord } from './ApprovalRequest';
import crypto from 'crypto';

export interface InterceptResult {
  /** Whether the action was intercepted and requires approval */
  intercepted: boolean;
  /** The approval request ID, if intercepted */
  requestId?: string;
}

import { DomainEventDispatcher } from '../events/DomainEventDispatcher';
import { ApprovalRequestApprovedEvent, ApprovalRequestRejectedEvent } from './ApprovalEvents';

export class ApprovalWorkflowService {
  constructor(
    private readonly prisma: PrismaClient
  ) {}

  /**
   * Evaluates whether a domain action should be intercepted.
   * If a matching active workflow exists and thresholds are met,
   * creates an ApprovalRequest and returns { intercepted: true }.
   */
  async evaluateAndIntercept(
    tenantId: string,
    triggerEvent: string,
    referenceType: string,
    referenceId: string,
    requesterId: string,
    payload: Record<string, any>
  ): Promise<InterceptResult> {
    // Look up active workflow for this tenant + trigger event
    const workflowRecord = await this.prisma.approvalWorkflowModel.findFirst({
      where: {
        tenantId,
        triggerEvent,
        isActive: true,
      }
    });

    if (!workflowRecord || !workflowRecord.isActive) {
      return { intercepted: false };
    }

    const config = (typeof workflowRecord.config === 'string' ? JSON.parse(workflowRecord.config) : workflowRecord.config) as ApprovalWorkflowConfig;
    const workflow = new ApprovalWorkflow(
      workflowRecord.id,
      workflowRecord.tenantId,
      workflowRecord.name,
      workflowRecord.triggerEvent,
      workflowRecord.isActive,
      config,
      workflowRecord.createdAt,
      workflowRecord.createdAt
    );

    if (!workflow.shouldTrigger(payload)) {
      return { intercepted: false };
    }

    // Calculate expiration based on first step timeout
    const firstStep = workflow.getStep(0);
    const expiresAt = firstStep && firstStep.timeoutHours > 0
      ? new Date(Date.now() + firstStep.timeoutHours * 60 * 60 * 1000)
      : undefined;

    // Create the approval request
    const requestId = crypto.randomUUID();
    await this.prisma.approvalRequestModel.create({
      data: {
        id: requestId,
        tenantId,
        workflowId: workflowRecord.id,
        referenceType,
        referenceId,
        requesterId,
        status: 'PENDING',
        currentStep: 0,
        payload: JSON.stringify(payload),
        expiresAt,
      }
    });

    return { intercepted: true, requestId };
  }

  /**
   * Processes an approve or reject decision on a pending request.
   * Returns the updated request status.
   */
  async processDecision(
    requestId: string,
    deciderId: string,
    decision: 'APPROVED' | 'REJECTED',
    notes?: string
  ): Promise<{ status: ApprovalRequestStatus; referenceType: string; referenceId: string }> {
    // Load the request and its workflow
    const requestRecord = await this.prisma.approvalRequestModel.findUnique({
      where: { id: requestId },
      include: {
        workflow: true,
        decisions: true,
      }
    });

    if (!requestRecord) {
      throw new Error(`Approval request ${requestId} not found.`);
    }

    const config = (typeof requestRecord.workflow.config === 'string' ? JSON.parse(requestRecord.workflow.config) : requestRecord.workflow.config) as ApprovalWorkflowConfig;
    const existingDecisions: ApprovalDecisionRecord[] = requestRecord.decisions.map(d => ({
      id: d.id,
      stepIndex: d.stepIndex,
      deciderId: d.deciderId,
      decision: d.decision as 'APPROVED' | 'REJECTED',
      notes: d.notes ?? undefined,
      decidedAt: d.createdAt,
    }));

    const request = ApprovalRequest.reconstruct(
      requestRecord.id,
      requestRecord.tenantId,
      requestRecord.workflowId,
      requestRecord.referenceType,
      requestRecord.referenceId,
      requestRecord.requesterId,
      JSON.parse(requestRecord.payload) as Record<string, any>,
      config.steps.length,
      requestRecord.status as ApprovalRequestStatus,
      requestRecord.currentStep,
      existingDecisions,
      requestRecord.expiresAt ?? undefined,
      requestRecord.createdAt,
      requestRecord.updatedAt
    );

    const decisionId = crypto.randomUUID();
    const decisionRecord: ApprovalDecisionRecord = {
      id: decisionId,
      stepIndex: request.currentStep,
      deciderId,
      decision,
      notes,
      decidedAt: new Date(),
    };

    if (decision === 'REJECTED') {
      request.reject(decisionRecord);
    } else {
      const currentStepConfig = config.steps[request.currentStep];
      request.approve(decisionRecord, currentStepConfig?.requiredCount ?? 1);
    }

    // Persist the decision and update the request
    await this.prisma.$transaction([
      this.prisma.approvalDecisionModel.create({
        data: {
          id: decisionId,
          requestId,
          stepIndex: decisionRecord.stepIndex,
          deciderId,
          decision,
          notes: notes ?? null,
        }
      }),
      this.prisma.approvalRequestModel.update({
        where: { id: requestId },
        data: {
          status: request.status,
          currentStep: request.currentStep,
        }
      })
    ]);

    if (request.status === ApprovalRequestStatus.Approved) {
      DomainEventDispatcher.dispatch([
        new ApprovalRequestApprovedEvent(
          request.id,
          request.tenantId,
          request.referenceType,
          request.referenceId,
          request.payload
        )
      ]);
    } else if (request.status === ApprovalRequestStatus.Rejected) {
      DomainEventDispatcher.dispatch([
        new ApprovalRequestRejectedEvent(
          request.id,
          request.tenantId,
          request.referenceType,
          request.referenceId,
          request.payload
        )
      ]);
    }

    return {
      status: request.status,
      referenceType: request.referenceType,
      referenceId: request.referenceId,
    };
  }

  /**
   * Checks for expired/stale approval requests and escalates or expires them.
   * Intended to be called by a cron worker.
   */
  async checkExpiredRequests(): Promise<number> {
    const now = new Date();
    const staleRequests = await this.prisma.approvalRequestModel.findMany({
      where: {
        status: { in: ['PENDING', 'ESCALATED'] },
        expiresAt: { lte: now },
      },
      include: { workflow: true }
    });

    let processedCount = 0;

    for (const record of staleRequests) {
      const config = (typeof record.workflow.config === 'string' ? JSON.parse(record.workflow.config) : record.workflow.config) as ApprovalWorkflowConfig;
      const request = ApprovalRequest.reconstruct(
        record.id, record.tenantId, record.workflowId,
        record.referenceType, record.referenceId, record.requesterId,
        JSON.parse(record.payload) as Record<string, any>,
        config.steps.length,
        record.status as ApprovalRequestStatus,
        record.currentStep,
        [], // decisions not needed for escalation
        record.expiresAt ?? undefined
      );

      request.escalate();

      // Compute new expiration if escalated to next step
      let newExpiresAt: Date | undefined = undefined;
      if (request.isPending) {
        const nextStep = config.steps[request.currentStep];
        if (nextStep && nextStep.timeoutHours > 0) {
          newExpiresAt = new Date(Date.now() + nextStep.timeoutHours * 60 * 60 * 1000);
        }
      }

      await this.prisma.approvalRequestModel.update({
        where: { id: record.id },
        data: {
          status: request.status,
          currentStep: request.currentStep,
          expiresAt: newExpiresAt,
        }
      });

      processedCount++;
    }

    return processedCount;
  }

  /**
   * Lists pending approval requests for a given tenant, optionally filtered
   * to requests where the decider's roles match the current step's approver roles.
   */
  async listPendingRequests(
    tenantId: string,
    deciderRoleIds?: string[]
  ): Promise<any[]> {
    const requests = await this.prisma.approvalRequestModel.findMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'ESCALATED'] },
      },
      include: {
        workflow: true,
        decisions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!deciderRoleIds || deciderRoleIds.length === 0) {
      return requests.map(req => ({
        ...req,
        payload: req.payload ? JSON.parse(req.payload) : {},
        workflow: {
          ...req.workflow,
          config: req.workflow.config ? JSON.parse(req.workflow.config) : {}
        }
      }));
    }

    // Filter to requests where current step's approverRoles overlap with decider's roles
    return requests.filter(req => {
      const config = (typeof req.workflow.config === 'string' ? JSON.parse(req.workflow.config) : req.workflow.config) as ApprovalWorkflowConfig;
      const currentStep = config.steps[req.currentStep];
      if (!currentStep) return false;
      return currentStep.approverRoles.some(role => deciderRoleIds.includes(role));
    }).map(req => ({
        ...req,
        payload: req.payload ? JSON.parse(req.payload) : {},
        workflow: {
          ...req.workflow,
          config: req.workflow.config ? JSON.parse(req.workflow.config) : {}
        }
    }));
  }
}
