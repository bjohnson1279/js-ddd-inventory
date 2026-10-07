import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { ComplianceController } from "../controllers/ComplianceController";
import { requireRole } from "../middleware/auth";

const router: FastifyPluginAsync = async (fastify) => {

fastify.get("/ledger", { preHandler: [requireRole(["admin"])] }, ComplianceController.list);
fastify.post("/verify", { preHandler: [requireRole(["admin"])] }, ComplianceController.verify);
fastify.get("/reconstruct", { preHandler: [requireRole(["admin"])] }, ComplianceController.reconstruct);
fastify.get("/replay", { preHandler: [requireRole(["admin"])] }, ComplianceController.replay);

};
export default router;
