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
fastify.get("/workflows", requirePermission('approval', 'view'), async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const tenantId = (req as any).user?.tenantId || (req as any).tenantId || "default-tenant";
    const result = await useCase.listWorkflows(tenantId);
    reply.send(result);
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.post("/workflows", requirePermission('approval', 'manage'), async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const tenantId = (req as any).user?.tenantId || (req as any).tenantId || "default-tenant";
    const result = await useCase.createWorkflow(tenantId, request.body);
    reply.status(201).send(result);
  } catch (error: any) {
    reply.status(400).send({ error: error.message });
  }
});

fastify.put("/workflows/:id", requirePermission('approval', 'manage'), async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const tenantId = (req as any).user?.tenantId || (req as any).tenantId || "default-tenant";
    const result = await useCase.updateWorkflow(tenantId, request.params.id, request.body.config);
    reply.send(result);
  } catch (error: any) {
    reply.status(400).send({ error: error.message });
  }
});

fastify.post("/workflows/:id/toggle", requirePermission('approval', 'manage'), async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const tenantId = (req as any).user?.tenantId || (req as any).tenantId || "default-tenant";
    const result = await useCase.toggleWorkflow(tenantId, request.params.id);
    reply.send(result);
  } catch (error: any) {
    reply.status(400).send({ error: error.message });
  }
});

// Approval request management
fastify.get("/pending", requirePermission('approval', 'view'), async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const tenantId = (req as any).user?.tenantId || (req as any).tenantId || "default-tenant";
    const result = await useCase.listPendingRequests(tenantId);
    reply.send(result);
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
});

// Retrieve an approval request by ID
fastify.get("/:id", requirePermission('approval', 'view'), async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const tenantId = (req as any).user?.tenantId || (req as any).tenantId || "default-tenant";
    const result = await useCase.getApprovalRequest(tenantId, request.params.id);
    if (!result) {
      return reply.status(404).send({ error: "Not found" });
    }
    reply.send(result);
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.post("/:id/decide", requirePermission('approval', 'manage'), async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const tenantId = (req as any).user?.tenantId || (req as any).tenantId || "default-tenant";
    const deciderId = (req as any).userId || "system"; // Get from auth ideally
    const { decision, notes } = request.body;
    const result = await useCase.submitDecision(tenantId, request.params.id, deciderId, decision, notes);
    reply.send(result);
  } catch (error: any) {
    reply.status(400).send({ error: error.message });
  }
});

};
export default router;
