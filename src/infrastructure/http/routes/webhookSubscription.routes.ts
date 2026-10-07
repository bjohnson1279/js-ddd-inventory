import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { WebhookSubscriptionController } from "../controllers/WebhookSubscriptionController";
import { requireRole } from "../middleware/auth";

const router: FastifyPluginAsync = async (fastify) => {

fastify.post("/", { preHandler: [requireRole(["admin"])] }, WebhookSubscriptionController.create);
fastify.get("/", { preHandler: [requireRole(["admin"])] }, WebhookSubscriptionController.list);
fastify.put("/:id", { preHandler: [requireRole(["admin"])] }, WebhookSubscriptionController.update);
fastify.delete("/:id", { preHandler: [requireRole(["admin"])] }, WebhookSubscriptionController.delete);

};
export default router;
