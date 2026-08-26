import { Router } from "express";
import { QuarantineController } from "../controllers/QuarantineController";
import { requirePermission } from "../middleware/auth";

const router = Router();

router.get("/", QuarantineController.list);
router.get("/:id", QuarantineController.get);
router.post("/:id/resolve", requirePermission('rma', 'view'), QuarantineController.resolve);

export default router;
