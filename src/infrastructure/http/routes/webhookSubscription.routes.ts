import { Router } from "express";
import { WebhookSubscriptionController } from "../controllers/WebhookSubscriptionController";
import { requirePermission } from "../middleware/auth";

const router = Router();

router.post("/", requirePermission('webhook', 'view'), WebhookSubscriptionController.create);
router.get("/", requirePermission('webhook', 'view'), WebhookSubscriptionController.list);
router.put("/:id", requirePermission('webhook', 'view'), WebhookSubscriptionController.update);
router.delete("/:id", requirePermission('webhook', 'view'), WebhookSubscriptionController.delete);

export default router;
