import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { AnomalyDetectionService } from "../../../domain/services/AnomalyDetectionService";

const router: FastifyPluginAsync = async (fastify) => {
const anomalyService = new AnomalyDetectionService();

fastify.get("/analyze", async (request: any, reply: any) => {
  try {
    const tenantId = (request as any).user?.tenantId || "tenant-1";
    const result = await anomalyService.analyze(tenantId);
    reply.send(result);
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

};
export default router;
