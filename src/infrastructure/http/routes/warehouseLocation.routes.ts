import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { WarehouseLocationController } from "../controllers/WarehouseLocationController";
import { requireRole } from "../middleware/auth";

const router: FastifyPluginAsync = async (fastify) => {

fastify.post("/", { preHandler: [requireRole(["admin", "warehouse_operator"])] }, WarehouseLocationController.save);
fastify.get("/", WarehouseLocationController.list);
fastify.get("/slotting-suggestions", { preHandler: [requireRole(["admin", "warehouse_operator"])] }, WarehouseLocationController.suggestSlotting);
fastify.delete("/:id", { preHandler: [requireRole(["admin", "warehouse_operator"])] }, WarehouseLocationController.delete);
fastify.post("/putaway-suggestions", WarehouseLocationController.suggestPutaway);
fastify.post("/optimize-pick-route", WarehouseLocationController.optimizePickRoute);

};
export default router;
