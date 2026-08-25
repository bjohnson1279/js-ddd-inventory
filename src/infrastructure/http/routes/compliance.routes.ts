import { Router } from "express";
import { ComplianceController } from "../controllers/ComplianceController";
import { requirePermission } from "../middleware/auth";

const router = Router();

router.get("/ledger", requirePermission('compliance', 'view'), ComplianceController.list);
router.post("/verify", requirePermission('compliance', 'view'), ComplianceController.verify);
router.get("/reconstruct", requirePermission('compliance', 'view'), ComplianceController.reconstruct);
router.get("/replay", requirePermission('compliance', 'view'), ComplianceController.replay);

export default router;
