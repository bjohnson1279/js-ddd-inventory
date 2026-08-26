import { Router } from "express";
import { AuditController } from "../controllers/AuditController";
import { requireRole } from "../middleware/auth";

const router = Router();

router.post("/run", requireRole(["admin"]), AuditController.runAudit);
router.get("/discrepancies", requireRole(["admin", "accountant", "viewer"]), AuditController.listDiscrepancies);
router.post("/discrepancies/:id/resolve", requireRole(["admin"]), AuditController.resolveDiscrepancy);

export default router;
