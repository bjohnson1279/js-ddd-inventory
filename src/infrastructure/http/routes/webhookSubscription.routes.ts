import { Router } from "express";
import { WebhookSubscriptionController } from "../controllers/WebhookSubscriptionController";
import { requireRole } from "../middleware/auth";

const router = Router();

router.post("/", requireRole(["admin"]), WebhookSubscriptionController.create);
router.get("/", requireRole(["admin"]), WebhookSubscriptionController.list);
router.put("/:id", requireRole(["admin"]), WebhookSubscriptionController.update);
router.delete("/:id", requireRole(["admin"]), WebhookSubscriptionController.delete);

export default router;
