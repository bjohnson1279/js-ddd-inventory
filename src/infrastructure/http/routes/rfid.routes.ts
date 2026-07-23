import { Router } from "express";
import { RfidController } from "../controllers/RfidController";

const router = Router();

router.get("/tags", RfidController.list);
router.post("/assign", RfidController.assign);
router.post("/simulate-scan", RfidController.simulateScan);

export default router;
