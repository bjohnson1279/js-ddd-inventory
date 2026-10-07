import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { BarcodeController } from "../controllers/BarcodeController";

const router: FastifyPluginAsync = async (fastify) => {

fastify.get("/", BarcodeController.list);
fastify.post("/assign", BarcodeController.assign);
fastify.post("/generate", BarcodeController.generate);
fastify.post("/scan", BarcodeController.scan);

};
export default router;
