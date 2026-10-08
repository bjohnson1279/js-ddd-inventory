import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { RebalanceOptimizationService } from "../../../domain/services/RebalanceOptimizationService";

const router: FastifyPluginAsync = async (fastify) => {
const rebalanceService = new RebalanceOptimizationService();

fastify.get("/matrix", async (request: any, reply: any) => {
  try {
    const tenantId = (request as any).user?.tenantId || "tenant-1";
    const result = await rebalanceService.optimize(tenantId);
    reply.send(result);
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

};
export default router;
