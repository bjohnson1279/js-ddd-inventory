import { Router } from "express";
import { ReorderPolicyController } from "../controllers/ReorderPolicyController";

const router = Router();

router.post("/", ReorderPolicyController.createOrUpdate);
router.get("/:sku/:locationId", ReorderPolicyController.get);

export default router;
