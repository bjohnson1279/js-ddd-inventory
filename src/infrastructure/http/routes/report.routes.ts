import { Router } from "express";
import { ReportController } from "../controllers/ReportController";
import { authMiddleware, requirePermission } from "../middleware/auth";

const router = Router();

router.post("/", authMiddleware, requirePermission("reports", "write"), ReportController.createReport);
router.get("/", authMiddleware, requirePermission("reports", "read"), ReportController.listReports);
router.post("/:id/execute", authMiddleware, requirePermission("reports", "read"), ReportController.executeReport);
router.post("/:id/schedule", authMiddleware, requirePermission("reports", "write"), ReportController.scheduleReport);
router.get("/shared/:token", ReportController.getSharedLink);

export default router;
