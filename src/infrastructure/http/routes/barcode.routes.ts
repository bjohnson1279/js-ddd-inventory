import { Router } from "express";
import { BarcodeController } from "../controllers/BarcodeController";

const router = Router();

router.get("/", BarcodeController.list);
router.post("/assign", BarcodeController.assign);
router.post("/generate", BarcodeController.generate);
router.post("/scan", BarcodeController.scan);

export default router;
