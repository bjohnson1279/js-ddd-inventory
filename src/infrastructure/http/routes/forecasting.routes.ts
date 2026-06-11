import { Router } from "express";
import { ForecastingController } from "../controllers/ForecastingController";

const router = Router();

router.get("/report", ForecastingController.getReport);
router.post("/forecast", ForecastingController.generateForecast);

export default router;
