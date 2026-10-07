import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { ForecastingController } from "../controllers/ForecastingController";

const router: FastifyPluginAsync = async (fastify) => {

fastify.get("/report", ForecastingController.getReport);
fastify.post("/forecast", ForecastingController.generateForecast);
fastify.get("/dispatch-summary", ForecastingController.getDispatchSummary);

};
export default router;
