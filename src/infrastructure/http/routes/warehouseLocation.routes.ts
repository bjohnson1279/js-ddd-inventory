import { Router } from "express";
import { WarehouseLocationController } from "../controllers/WarehouseLocationController";
import { requireRole } from "../middleware/auth";

const router = Router();

router.post("/", requireRole(["admin", "warehouse_operator"]), WarehouseLocationController.save);
router.get("/", requireRole(["admin", "warehouse_operator", "viewer"]), WarehouseLocationController.list);
router.delete("/:id", requireRole(["admin", "warehouse_operator"]), WarehouseLocationController.delete);
router.post("/putaway-suggestions", requireRole(["admin", "warehouse_operator"]), WarehouseLocationController.suggestPutaway);
router.post("/optimize-pick-route", requireRole(["admin", "warehouse_operator"]), WarehouseLocationController.optimizePickRoute);

export default router;
