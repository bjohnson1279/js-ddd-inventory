import { Router } from "express";
import { requirePermission } from "../middleware/auth";
import { ManageApprovalWorkflowsUseCase } from "../../../application/useCases/ManageApprovalWorkflowsUseCase";

const router = Router();

/**
 * Approval Workflow Routes
 *
 * GET  /api/approvals/workflows            — List workflows for tenant
 * POST /api/approvals/workflows            — Create workflow
 * PUT  /api/approvals/workflows/:id        — Update workflow config
 * POST /api/approvals/workflows/:id/toggle — Toggle active/inactive
 * GET  /api/approvals/pending              — List pending approval requests
 * GET  /api/approvals/:id                  — Get approval request detail
 * POST /api/approvals/:id/decide           — Submit approval decision
 */

// Workflow management (admin only)
router.get("/workflows", requirePermission('approval', 'view'), (req, res) => {
  // TODO: Wire to ManageApprovalWorkflowsUseCase.listWorkflows
  res.status(501).json({ error: "Not yet implemented" });
});

router.post("/workflows", requirePermission('approval', 'view'), async (req, res) => {
  try {
    const tenantId = (req as any).tenantId || "default-tenant";
    const useCase = new ManageApprovalWorkflowsUseCase();
    const result = await useCase.createWorkflow(tenantId, req.body);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/workflows/:id", requirePermission('approval', 'view'), (req, res) => {
  // TODO: Wire to ManageApprovalWorkflowsUseCase.updateWorkflow
  res.status(501).json({ error: "Not yet implemented" });
});

router.post("/workflows/:id/toggle", requirePermission('approval', 'view'), (req, res) => {
  // TODO: Wire to ManageApprovalWorkflowsUseCase.toggleWorkflow
  res.status(501).json({ error: "Not yet implemented" });
});

// Approval request management
router.get("/pending", requirePermission('approval', 'view'), (req, res) => {
  // TODO: Wire to ManageApprovalWorkflowsUseCase.listPendingRequests
  res.status(501).json({ error: "Not yet implemented" });
});

router.get("/:id", requirePermission('approval', 'view'), (req, res) => {
  // TODO: Wire to ManageApprovalWorkflowsUseCase.getApprovalRequest
  res.status(501).json({ error: "Not yet implemented" });
});

router.post("/:id/decide", requirePermission('approval', 'view'), (req, res) => {
  // TODO: Wire to ManageApprovalWorkflowsUseCase.submitDecision
  res.status(501).json({ error: "Not yet implemented" });
});

export default router;
