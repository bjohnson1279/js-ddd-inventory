import { Router } from "express";
import { ReorderPolicyController } from "../controllers/ReorderPolicyController";

const router = Router();

router.post("/", ReorderPolicyController.createOrUpdate);
router.post("/evaluate", ReorderPolicyController.evaluate);
router.get("/:sku/:locationId", ReorderPolicyController.get);

export default router;
