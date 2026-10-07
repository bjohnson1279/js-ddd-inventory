import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { InventoryController } from "../controllers/InventoryController";
import { requireRole } from "../middleware/auth";

const router: FastifyPluginAsync = async (fastify) => {

fastify.get("/", InventoryController.list);
fastify.post("/receive", InventoryController.receive);
fastify.post("/dispatch", InventoryController.dispatch);
fastify.post("/count", InventoryController.performCount);
fastify.get("/fefo-pick", InventoryController.suggestFefoPick);
fastify.get("/reports/recall/:lotNumber", InventoryController.traceRecall);
fastify.get("/:sku", InventoryController.getLevel);

fastify.post("/allocate", { preHandler: [requireRole(["admin", "warehouse_operator"])] }, InventoryController.allocate);
fastify.post("/release-allocation", { preHandler: [requireRole(["admin", "warehouse_operator"])] }, InventoryController.releaseAllocation);
fastify.post("/fulfill-allocation", { preHandler: [requireRole(["admin", "warehouse_operator"])] }, InventoryController.fulfillAllocation);
fastify.post("/create-in-transit", { preHandler: [requireRole(["admin", "warehouse_operator"])] }, InventoryController.createInTransit);
fastify.post("/receive-in-transit", { preHandler: [requireRole(["admin", "warehouse_operator"])] }, InventoryController.receiveInTransit);

};
export default router;
