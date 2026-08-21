import { Router } from "express";
import { AuditController } from "../controllers/AuditController";
import { requirePermission } from "../middleware/auth";

const router = Router();

router.post("/run", requirePermission('compliance', 'view'), AuditController.runAudit);
router.get("/discrepancies", requirePermission('compliance', 'view'), AuditController.listDiscrepancies);
router.post("/discrepancies/:id/resolve", requirePermission('compliance', 'view'), AuditController.resolveDiscrepancy);

export default router;
