import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { RfidController } from "../controllers/RfidController";

const router: FastifyPluginAsync = async (fastify) => {

fastify.get("/tags", RfidController.list);
fastify.post("/assign", RfidController.assign);
fastify.post("/simulate-scan", RfidController.simulateScan);

};
export default router;
