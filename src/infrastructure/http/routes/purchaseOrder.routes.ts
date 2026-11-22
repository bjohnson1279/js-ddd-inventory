import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { PurchaseOrderController } from "../controllers/PurchaseOrderController";
import { prisma } from "../../database/prisma";

const router: FastifyPluginAsync = async (fastify) => {

fastify.get("/", async (request: any, reply: any) => {
  try {
    const tenantId = request.tenantId || (request.query as any)?.tenantId;
    const orders = await prisma.purchaseOrderModel.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    reply.status(200).send(orders);
  } catch (err: any) {
    reply.status(500).send({ error: err?.message || "Failed to list purchase orders" });
  }
});
fastify.post("/", PurchaseOrderController.create);
fastify.get("/:id", PurchaseOrderController.get);
fastify.post("/:id/approve", PurchaseOrderController.approve);
fastify.post("/:id/send", PurchaseOrderController.send);
fastify.post("/:id/receive", PurchaseOrderController.receive);

};
export default router;
