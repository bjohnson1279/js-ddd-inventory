import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { QuarantineController } from "../controllers/QuarantineController";
import { requireRole } from "../middleware/auth";

const router: FastifyPluginAsync = async (fastify) => {

fastify.get("/", QuarantineController.list);
fastify.get("/:id", QuarantineController.get);
fastify.post("/:id/resolve", { preHandler: [requireRole(["admin", "warehouse_operator"])] }, QuarantineController.resolve);

};
export default router;
