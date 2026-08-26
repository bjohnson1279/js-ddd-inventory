import { Router } from "express";
import { RMAController } from "../controllers/RMAController";
import { requireRole } from "../middleware/auth";

const router = Router();

router.post("/", requireRole(["admin", "warehouse_operator"]), RMAController.create);
router.get("/:id", RMAController.get);
router.post("/:id/authorize", requireRole(["admin", "warehouse_operator"]), RMAController.authorize);
router.post("/:id/receive", requireRole(["admin", "warehouse_operator"]), RMAController.receive);

export default router;
