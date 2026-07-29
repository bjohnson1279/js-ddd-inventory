import { Router } from "express";
import { AnomalyDetectionService } from "../../../domain/services/AnomalyDetectionService";

const router = Router();
const anomalyService = new AnomalyDetectionService();

router.get("/analyze", async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId || "tenant-1";
    const result = await anomalyService.analyze(tenantId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
