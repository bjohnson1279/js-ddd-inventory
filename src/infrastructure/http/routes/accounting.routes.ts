import { Router } from "express";
import { AccountingController } from "../controllers/AccountingController";

const router = Router();

router.get("/ledger", AccountingController.getLedger);
router.post("/stock-received", AccountingController.recordStockReceived);
router.post("/stock-sold", AccountingController.recordStockSold);
router.get("/valuation/:variantId", AccountingController.calculateValuation);
router.get("/tenant-config/:tenantId", AccountingController.getTenantConfig);
router.post("/tenant-config", AccountingController.saveTenantConfig);

export default router;
