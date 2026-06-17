import { Router } from "express";
import { NotificationController } from "../controllers/NotificationController";

const router = Router();

router.get("/", NotificationController.list);
router.post("/", NotificationController.create);
router.post("/read-all", NotificationController.readAll);
router.get("/subscribe", NotificationController.subscribe);
router.post("/:id/read", NotificationController.read);

export default router;
