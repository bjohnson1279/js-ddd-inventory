import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { ReorderPolicyController } from "../controllers/ReorderPolicyController";

const router: FastifyPluginAsync = async (fastify) => {

fastify.post("/", ReorderPolicyController.createOrUpdate);
fastify.post("/evaluate", ReorderPolicyController.evaluate);
fastify.get("/:sku/:locationId", ReorderPolicyController.get);

};
export default router;
