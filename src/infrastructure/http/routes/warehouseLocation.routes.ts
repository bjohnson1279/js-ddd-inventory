import { Router } from "express";
import { WarehouseLocationController } from "../controllers/WarehouseLocationController";
import { requireRole } from "../middleware/auth";

const router = Router();

router.post("/", requireRole(["admin", "warehouse_operator"]), WarehouseLocationController.save);
router.get("/", WarehouseLocationController.list);
router.delete("/:id", requireRole(["admin", "warehouse_operator"]), WarehouseLocationController.delete);
router.post("/putaway-suggestions", WarehouseLocationController.suggestPutaway);
router.post("/optimize-pick-route", WarehouseLocationController.optimizePickRoute);

export default router;
