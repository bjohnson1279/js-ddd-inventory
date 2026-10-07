import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { SerialController } from "../controllers/SerialController";

const router: FastifyPluginAsync = async (fastify) => {

fastify.get("/", SerialController.list);
fastify.post("/register", SerialController.register);
fastify.post("/receive", SerialController.receive);
fastify.post("/sell", SerialController.sell);
fastify.post("/return", SerialController.acceptReturn);
fastify.post("/restock", SerialController.restock);
fastify.get("/:serialNumber/history", SerialController.getHistory);

};
export default router;
