import { Router } from "express";
import { RebalanceOptimizationService } from "../../../domain/services/RebalanceOptimizationService";
import { Logger } from "../../logging/logger";

const router = Router();
const rebalanceService = new RebalanceOptimizationService();

router.get("/matrix", async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId || "tenant-1";
    const result = await rebalanceService.optimize(tenantId);
    res.json(result);
  } catch (err: any) {
    Logger.error({ context: "API", message: "An error occurred", error: err.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
