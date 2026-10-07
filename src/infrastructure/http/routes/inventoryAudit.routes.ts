import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { InventoryAuditController } from "../controllers/InventoryAuditController";

const router: FastifyPluginAsync = async (fastify) => {

fastify.post("/", InventoryAuditController.create);
fastify.get("/:id", InventoryAuditController.get);
fastify.post("/:id/start", InventoryAuditController.start);
fastify.post("/:id/count", InventoryAuditController.recordCount);
fastify.post("/:id/complete", InventoryAuditController.complete);
fastify.post("/:id/reconcile", InventoryAuditController.reconcile);

};
export default router;
