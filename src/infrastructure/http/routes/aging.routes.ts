import { Router, Request, Response } from 'express';
import { prisma } from '../../database/prisma';
import { AgingAnalysisService } from '../../../domain/aging/AgingAnalysisService';
import { DeadStockDetector } from '../../../domain/aging/DeadStockDetector';

export const agingRouter = Router();
const agingService = new AgingAnalysisService();
const deadStockDetector = new DeadStockDetector();

agingRouter.get('/report/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
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
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate aging report' });
  }
});

agingRouter.get('/dead-stock/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const days = parseInt(req.query.days as string) || 180;
    
    // Find dispatches in the last N days
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    // This is a naive implementation for demonstration, assuming dispatch records hold tenant via location or just global
    // Actually DispatchRecordModel lacks tenantId in the schema, but we can query inventory first
    const inventory = await prisma.inventoryCostLayerModel.groupBy({
      by: ['variantId'],
      where: { tenantId, remainingQuantity: { gt: 0 } },
    });
    
    const inventorySkus = inventory.map(i => i.variantId);

    const dispatches = await prisma.dispatchRecordModel.findMany({
      where: {
        sku: { in: inventorySkus },
        dispatchedAt: { gte: sinceDate }
      },
      select: { sku: true }
    });

    const deadStockSkus = deadStockDetector.identifyDeadStock(inventorySkus, dispatches);
    res.status(200).json({ periodDays: days, deadStockSkus });
  } catch (error) {
    res.status(500).json({ error: 'Failed to detect dead stock' });
  }
});
