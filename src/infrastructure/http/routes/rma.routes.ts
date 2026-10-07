import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { RMAController } from "../controllers/RMAController";
import { requireRole } from "../middleware/auth";

const router: FastifyPluginAsync = async (fastify) => {

fastify.post("/", { preHandler: [requireRole(["admin", "warehouse_operator"])] }, RMAController.create);
fastify.get("/:id", RMAController.get);
fastify.post("/:id/authorize", { preHandler: [requireRole(["admin", "warehouse_operator"])] }, RMAController.authorize);
fastify.post("/:id/receive", { preHandler: [requireRole(["admin", "warehouse_operator"])] }, RMAController.receive);

};
export default router;
