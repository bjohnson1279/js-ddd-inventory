import { Router } from "express";
import { RebalanceOptimizationService } from "../../../domain/services/RebalanceOptimizationService";

const router = Router();
const rebalanceService = new RebalanceOptimizationService();

router.get("/matrix", async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId || "tenant-1";
    const result = await rebalanceService.optimize(tenantId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
