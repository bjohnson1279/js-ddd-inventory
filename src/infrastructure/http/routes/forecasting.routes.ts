import { Router } from "express";
import { ForecastingController } from "../controllers/ForecastingController";

const router = Router();

router.get("/report", ForecastingController.getReport);
router.post("/forecast", ForecastingController.generateForecast);
router.get("/dispatch-summary", ForecastingController.getDispatchSummary);

export default router;
