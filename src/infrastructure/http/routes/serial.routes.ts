import { Router } from "express";
import { SerialController } from "../controllers/SerialController";

const router = Router();

router.get("/", SerialController.list);
router.post("/register", SerialController.register);
router.post("/receive", SerialController.receive);
router.post("/sell", SerialController.sell);
router.post("/return", SerialController.acceptReturn);
router.post("/restock", SerialController.restock);
router.get("/:serialNumber/history", SerialController.getHistory);

export default router;
