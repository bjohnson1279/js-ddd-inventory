import { Router } from "express";
import { InventoryAuditController } from "../controllers/InventoryAuditController";

const router = Router();

router.post("/", InventoryAuditController.create);
router.get("/:id", InventoryAuditController.get);
router.post("/:id/start", InventoryAuditController.start);
router.post("/:id/count", InventoryAuditController.recordCount);
router.post("/:id/complete", InventoryAuditController.complete);
router.post("/:id/reconcile", InventoryAuditController.reconcile);

export default router;
