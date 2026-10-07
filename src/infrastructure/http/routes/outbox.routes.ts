import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { OutboxController } from "../controllers/OutboxController";

const router: FastifyPluginAsync = async (fastify) => {

fastify.get("/stats", OutboxController.getStats);
fastify.get("/dead-letter", OutboxController.listDeadLettered);
fastify.post("/:id/retry", OutboxController.retry);

};
export default router;
