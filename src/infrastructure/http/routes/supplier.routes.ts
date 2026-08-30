import { Router, Request, Response } from 'express';
import { prisma } from '../../database/prisma';
import { SupplierPrismaRepository } from '../../repositories/SupplierPrismaRepository';
import { SupplierOTIFCalculator } from '../../../domain/supplier/SupplierOTIFCalculator';
import { ASN } from '../../../domain/supplier/ASN';

export const supplierRouter = Router();
const repo = new SupplierPrismaRepository(prisma as any);
const calculator = new SupplierOTIFCalculator();

supplierRouter.post('/asn', async (req: Request, res: Response) => {
  try {
    const asn = await repo.saveASN({
      asnNumber: req.body.asnNumber,
      supplierId: req.body.supplierId,
      expectedDelivery: new Date(req.body.expectedDelivery),
      actualDelivery: req.body.actualDelivery ? new Date(req.body.actualDelivery) : null,
      status: req.body.status || 'IN_TRANSIT',
    });
    res.status(201).json(asn);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ASN' });
  }
});

supplierRouter.get('/scorecard/:supplierId', async (req: Request, res: Response) => {
  try {
    const { supplierId } = req.params;
    const dbAsns = await repo.getASNsForSupplier(supplierId);
    
    // Map to domain entity
    const domainAsns: ASN[] = dbAsns.map(asn => ({
      id: asn.id,
      asnNumber: asn.asnNumber,
      supplierId: asn.supplierId,
      expectedDelivery: asn.expectedDelivery,
      actualDelivery: asn.actualDelivery,
      status: asn.status as any,
      createdAt: asn.createdAt
    }));

    const { onTimeRate, otifScore } = calculator.calculateOTIF(domainAsns);
    const scorecard = await repo.saveScorecard(supplierId, onTimeRate, onTimeRate, 0, otifScore); // simplified
    
    res.status(200).json(scorecard);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate scorecard' });
  }
});
