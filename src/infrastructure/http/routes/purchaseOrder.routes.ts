import { Router } from "express";
import { PurchaseOrderController } from "../controllers/PurchaseOrderController";

const router = Router();

router.post("/", PurchaseOrderController.create);
router.get("/:id", PurchaseOrderController.get);
router.post("/:id/approve", PurchaseOrderController.approve);
router.post("/:id/send", PurchaseOrderController.send);
router.post("/:id/receive", PurchaseOrderController.receive);

export default router;
