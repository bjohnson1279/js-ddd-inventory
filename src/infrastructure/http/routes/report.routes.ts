import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { ReportController } from "../controllers/ReportController";
import { authMiddleware, requirePermission } from "../middleware/auth";

const router: FastifyPluginAsync = async (fastify) => {

fastify.post("/", { preHandler: [authMiddleware, requirePermission("reports", "write")] }, ReportController.createReport);
fastify.get("/", { preHandler: [authMiddleware, requirePermission("reports", "read")] }, ReportController.listReports);
fastify.post("/:id/execute", { preHandler: [authMiddleware, requirePermission("reports", "read")] }, ReportController.executeReport);
fastify.post("/:id/schedule", { preHandler: [authMiddleware, requirePermission("reports", "write")] }, ReportController.scheduleReport);
fastify.get("/shared/:token", ReportController.getSharedLink);

};
export default router;
