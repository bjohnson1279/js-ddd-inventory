import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { KitController } from "../controllers/KitController";
import { requireRole } from "../middleware/auth";

const router: FastifyPluginAsync = async (fastify) => {

fastify.get("/", KitController.list);
fastify.post("/create", KitController.create);
fastify.post("/dispatch", KitController.dispatchSale);
fastify.post("/assemble", { preHandler: [requireRole(["admin", "warehouse_operator"])] }, KitController.assemble);
fastify.post("/disassemble", { preHandler: [requireRole(["admin", "warehouse_operator"])] }, KitController.disassemble);

};
export default router;
