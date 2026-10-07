import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { PurchaseOrderController } from "../controllers/PurchaseOrderController";

const router: FastifyPluginAsync = async (fastify) => {

fastify.post("/", PurchaseOrderController.create);
fastify.get("/:id", PurchaseOrderController.get);
fastify.post("/:id/approve", PurchaseOrderController.approve);
fastify.post("/:id/send", PurchaseOrderController.send);
fastify.post("/:id/receive", PurchaseOrderController.receive);

};
export default router;
