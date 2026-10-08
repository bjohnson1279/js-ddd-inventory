import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middleware/auth";
import { ManageApprovalWorkflowsUseCase } from "../../../application/useCases/ManageApprovalWorkflowsUseCase";
import { ApprovalWorkflowService } from "../../../domain/approval/ApprovalWorkflowService";
import { prisma } from "../../database/prisma";
import { DomainEventDispatcher } from "../../../domain/events/DomainEventDispatcher";

const router: FastifyPluginAsync = async (fastify) => {

const dispatcher = new DomainEventDispatcher();
const workflowService = new ApprovalWorkflowService(prisma as any);
const useCase = new ManageApprovalWorkflowsUseCase(workflowService);

// Workflow management (admin only) - routes
fastify.get("/workflows", { preHandler: [requirePermission('approval', 'view')] }, async (request: any, reply: any) => {
  try {
    const tenantId = (request as any).user?.tenantId || (request as any).tenantId || "default-tenant";
    const result = await useCase.listWorkflows(tenantId);
    reply.send(result);
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.post("/workflows", { preHandler: [requirePermission('approval', 'manage')] }, async (request: any, reply: any) => {
  try {
    const tenantId = (request as any).user?.tenantId || (request as any).tenantId || "default-tenant";
    const result = await useCase.createWorkflow(tenantId, (request.body as any));
    reply.status(201).send(result);
  } catch (error: any) {
    reply.status(400).send({ error: error.message });
  }
});

fastify.put("/workflows/:id", { preHandler: [requirePermission('approval', 'manage')] }, async (request: any, reply: any) => {
  try {
    const tenantId = (request as any).user?.tenantId || (request as any).tenantId || "default-tenant";
    const result = await useCase.updateWorkflow(tenantId, (request.params as any).id, (request.body as any).config);
    reply.send(result);
  } catch (error: any) {
    reply.status(400).send({ error: error.message });
  }
});

fastify.post("/workflows/:id/toggle", { preHandler: [requirePermission('approval', 'manage')] }, async (request: any, reply: any) => {
  try {
    const tenantId = (request as any).user?.tenantId || (request as any).tenantId || "default-tenant";
    const result = await useCase.toggleWorkflow(tenantId, (request.params as any).id);
    reply.send(result);
  } catch (error: any) {
    reply.status(400).send({ error: error.message });
  }
});

// Approval request management
fastify.get("/pending", { preHandler: [requirePermission('approval', 'view')] }, async (request: any, reply: any) => {
  try {
    const tenantId = (request as any).user?.tenantId || (request as any).tenantId || "default-tenant";
    const result = await useCase.listPendingRequests(tenantId);
    reply.send(result);
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
});

// Retrieve an approval request by ID
fastify.get("/:id", { preHandler: [requirePermission('approval', 'view')] }, async (request: any, reply: any) => {
  try {
    const tenantId = (request as any).user?.tenantId || (request as any).tenantId || "default-tenant";
    const result = await useCase.getApprovalRequest(tenantId, (request.params as any).id);
    if (!result) {
      return reply.status(404).send({ error: "Not found" });
    }
    reply.send(result);
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.post("/:id/decide", { preHandler: [requirePermission('approval', 'manage')] }, async (request: any, reply: any) => {
  try {
    const tenantId = (request as any).user?.tenantId || (request as any).tenantId || "default-tenant";
    const deciderId = (request as any).userId || "system"; // Get from auth ideally
    const { decision, notes } = (request.body as any);
    const result = await useCase.submitDecision(tenantId, (request.params as any).id, deciderId, decision, notes);
    reply.send(result);
  } catch (error: any) {
    reply.status(400).send({ error: error.message });
  }
});

};
export default router;
