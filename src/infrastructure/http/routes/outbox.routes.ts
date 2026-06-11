import { Router } from "express";
import { OutboxController } from "../controllers/OutboxController";

const router = Router();

router.get("/stats", OutboxController.getStats);
router.get("/dead-letter", OutboxController.listDeadLettered);
router.post("/:id/retry", OutboxController.retry);

export default router;
