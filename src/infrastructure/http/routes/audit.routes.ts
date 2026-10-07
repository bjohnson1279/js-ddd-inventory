import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { AuditController } from "../controllers/AuditController";
import { requireRole } from "../middleware/auth";

const router: FastifyPluginAsync = async (fastify) => {

fastify.post("/run", { preHandler: [requireRole(["admin"])] }, AuditController.runAudit);
fastify.get("/discrepancies", { preHandler: [requireRole(["admin", "accountant", "viewer"])] }, AuditController.listDiscrepancies);
fastify.post("/discrepancies/:id/resolve", { preHandler: [requireRole(["admin"])] }, AuditController.resolveDiscrepancy);

};
export default router;
