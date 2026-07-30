import { Router } from "express";
import { ComplianceController } from "../controllers/ComplianceController";
import { requireRole } from "../middleware/auth";

const router = Router();

router.get("/ledger", requireRole(["admin"]), ComplianceController.list);
router.post("/verify", requireRole(["admin"]), ComplianceController.verify);
router.get("/reconstruct", requireRole(["admin"]), ComplianceController.reconstruct);
router.get("/replay", requireRole(["admin"]), ComplianceController.replay);

export default router;
