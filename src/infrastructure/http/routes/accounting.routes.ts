import { Router } from "express";
import { AccountingController } from "../controllers/AccountingController";
import { requireRole } from "../middleware/auth";

const router = Router();

router.get("/ledger", requireRole(["admin", "accountant"]), AccountingController.getLedger);
router.post("/stock-received", requireRole(["admin", "accountant"]), AccountingController.recordStockReceived);
router.post("/stock-sold", requireRole(["admin", "accountant"]), AccountingController.recordStockSold);
router.get("/valuation/:variantId", requireRole(["admin", "accountant"]), AccountingController.calculateValuation);
router.get("/tenant-config/:tenantId", requireRole(["admin", "accountant"]), AccountingController.getTenantConfig);
router.post("/tenant-config", requireRole(["admin", "accountant"]), AccountingController.saveTenantConfig);

export default router;
