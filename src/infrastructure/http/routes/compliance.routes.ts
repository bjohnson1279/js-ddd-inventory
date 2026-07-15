import { Router } from "express";
import { ComplianceController } from "../controllers/ComplianceController";
import { requireRole } from "../middleware/auth";

const router = Router();

router.get("/ledger", requireRole(["admin"]), ComplianceController.list);
router.post("/verify", requireRole(["admin"]), ComplianceController.verify);

export default router;
