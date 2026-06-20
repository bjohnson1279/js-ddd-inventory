import { Router } from "express";
import { QuarantineController } from "../controllers/QuarantineController";
import { requireRole } from "../middleware/auth";

const router = Router();

router.get("/", QuarantineController.list);
router.get("/:id", QuarantineController.get);
router.post("/:id/resolve", requireRole(["admin", "warehouse_operator"]), QuarantineController.resolve);

export default router;
