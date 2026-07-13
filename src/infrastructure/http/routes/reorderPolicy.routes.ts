import { Router } from "express";
import { ReorderPolicyController } from "../controllers/ReorderPolicyController";
import { requireRole } from "../middleware/auth";

const router = Router();

router.post("/", requireRole(["admin", "warehouse_operator"]), ReorderPolicyController.createOrUpdate);
router.post("/evaluate", requireRole(["admin", "warehouse_operator"]), ReorderPolicyController.evaluate);
router.get("/:sku/:locationId", requireRole(["admin", "warehouse_operator", "viewer"]), ReorderPolicyController.get);

export default router;
