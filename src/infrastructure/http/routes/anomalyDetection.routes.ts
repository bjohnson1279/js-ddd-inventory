import { Router } from "express";
import { AnomalyDetectionService } from "../../../domain/services/AnomalyDetectionService";
import { Logger } from "../../logging/logger";

const router = Router();
const anomalyService = new AnomalyDetectionService();

router.get("/analyze", async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId || "tenant-1";
    const result = await anomalyService.analyze(tenantId);
    res.json(result);
  } catch (err: any) {
    Logger.error({ context: "API", message: "An error occurred", error: err.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
