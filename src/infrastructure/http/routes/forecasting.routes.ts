import { Router } from "express";
import { requireRole } from "../middleware/auth";

import { ForecastingController } from "../controllers/ForecastingController";

const router = Router();

router.get("/report", requireRole(["admin", "accountant", "warehouse_operator"]), ForecastingController.getReport);
router.post("/forecast", requireRole(["admin", "accountant", "warehouse_operator"]), ForecastingController.generateForecast);
router.get("/dispatch-summary", requireRole(["admin", "accountant", "warehouse_operator"]), ForecastingController.getDispatchSummary);

export default router;
