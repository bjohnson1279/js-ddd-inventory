import { Router } from "express";
import { requirePermission } from "../middleware/auth";
import { ManageApprovalWorkflowsUseCase } from "../../../application/useCases/ManageApprovalWorkflowsUseCase";

const router = Router();
const useCase = new ManageApprovalWorkflowsUseCase();

// Workflow management (admin only) - routes
router.get("/workflows", requirePermission('approval', 'view'), async (req, res) => {
  try {
    const tenantId = (req as any).tenantId || "default-tenant";
    const result = await useCase.listWorkflows(tenantId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/workflows", requirePermission('approval', 'manage'), async (req, res) => {
  try {
    const tenantId = (req as any).tenantId || "default-tenant";
    const result = await useCase.createWorkflow(tenantId, req.body);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/workflows/:id", requirePermission('approval', 'manage'), async (req, res) => {
  try {
    const tenantId = (req as any).tenantId || "default-tenant";
    const result = await useCase.updateWorkflow(tenantId, req.params.id, req.body.config);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/workflows/:id/toggle", requirePermission('approval', 'manage'), async (req, res) => {
  try {
    const tenantId = (req as any).tenantId || "default-tenant";
    const result = await useCase.toggleWorkflow(tenantId, req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Approval request management
router.get("/pending", requirePermission('approval', 'view'), async (req, res) => {
  try {
    const tenantId = (req as any).tenantId || "default-tenant";
    const result = await useCase.listPendingRequests(tenantId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", requirePermission('approval', 'view'), async (req, res) => {
  try {
    const tenantId = (req as any).tenantId || "default-tenant";
    const result = await useCase.getApprovalRequest(tenantId, req.params.id);
    if (!result) return res.status(404).json({ error: "Not found" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/decide", requirePermission('approval', 'manage'), async (req, res) => {
  try {
    const tenantId = (req as any).tenantId || "default-tenant";
    const deciderId = (req as any).userId || "system"; // Get from auth ideally
    const { decision, notes } = req.body;
    const result = await useCase.submitDecision(tenantId, req.params.id, deciderId, decision, notes);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
