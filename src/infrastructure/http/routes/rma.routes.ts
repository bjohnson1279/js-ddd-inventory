import { Router } from "express";
import { RMAController } from "../controllers/RMAController";
import { requirePermission } from "../middleware/auth";

const router = Router();

router.post("/", requirePermission('rma', 'view'), RMAController.create);
router.get("/:id", RMAController.get);
router.post("/:id/authorize", requirePermission('rma', 'view'), RMAController.authorize);
router.post("/:id/receive", requirePermission('rma', 'view'), RMAController.receive);

export default router;
