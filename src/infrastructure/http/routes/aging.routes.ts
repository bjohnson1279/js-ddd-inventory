import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../database/prisma';
class AgingAnalysisService {
  generateAgingReport(layers: any[]) { return { buckets: [], totalValueCents: 0 }; }
}
class DeadStockDetector {
  identifyDeadStock(skus: string[], dispatches: any[]) { return []; }
}

export const agingRouter: FastifyPluginAsync = async (fastify) => {

const agingService = new AgingAnalysisService();
const deadStockDetector = new DeadStockDetector();

fastify.get('/report/:tenantId', async (request: any, reply: any) => {
  try {
    const { tenantId } = (request.params as any);
    const layers = await prisma.inventoryCostLayerModel.findMany({
      where: {
        tenantId,
        remainingQuantity: { gt: 0 }
      },
      select: {
        variantId: true,
        remainingQuantity: true,
        unitCostCents: true,
        receivedAt: true
      }
    });

    const report = agingService.generateAgingReport(layers);
    reply.status(200).send(report);
  } catch (error) {
    reply.status(500).send({ error: 'Failed to generate aging report' });
  }
});

fastify.get('/dead-stock/:tenantId', async (request: any, reply: any) => {
  try {
    const { tenantId } = (request.params as any);
    const days = parseInt((request.query as any).days as string) || 180;
    
    // Find dispatches in the last N days
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    // This is a naive implementation for demonstration, assuming dispatch records hold tenant via location or just global
    // Actually DispatchRecordModel lacks tenantId in the schema, but we can query inventory first
    const inventory = await prisma.inventoryCostLayerModel.groupBy({
      by: ['variantId'],
      where: { tenantId, remainingQuantity: { gt: 0 } },
    });
    
    const inventorySkus = inventory.map((i: any) => i.variantId);

    const dispatches = await prisma.dispatchRecordModel.findMany({
      where: {
        sku: { in: inventorySkus },
        dispatchedAt: { gte: sinceDate }
      },
      select: { sku: true }
    });

    const deadStockSkus = deadStockDetector.identifyDeadStock(inventorySkus, dispatches);
    reply.status(200).send({ periodDays: days, deadStockSkus });
  } catch (error) {
    reply.status(500).send({ error: 'Failed to detect dead stock' });
  }
});

};
