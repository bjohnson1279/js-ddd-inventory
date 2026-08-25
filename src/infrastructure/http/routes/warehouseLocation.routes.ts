import { Router } from "express";
import { WarehouseLocationController } from "../controllers/WarehouseLocationController";
import { requirePermission } from "../middleware/auth";

const router = Router();

router.post("/", requirePermission('warehouse', 'view'), WarehouseLocationController.save);
router.get("/", WarehouseLocationController.list);
router.get("/slotting-suggestions", requirePermission('warehouse', 'view'), WarehouseLocationController.suggestSlotting);
router.delete("/:id", requirePermission('warehouse', 'view'), WarehouseLocationController.delete);
router.post("/putaway-suggestions", WarehouseLocationController.suggestPutaway);
router.post("/optimize-pick-route", WarehouseLocationController.optimizePickRoute);

export default router;
