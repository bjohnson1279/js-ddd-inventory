import { Router, Request, Response } from 'express';
import { prisma } from '../../database/prisma';
import { IntercompanyTransferService } from '../../../domain/accounting/services/IntercompanyTransferService';
import { PrismaIntercompanyRepository } from '../../database/PrismaIntercompanyRepository';
import { LegalEntity } from '../../../domain/accounting/aggregates/LegalEntity';

export const intercompanyRouter = Router();
const transferService = new IntercompanyTransferService();
const transferRepo = new PrismaIntercompanyRepository();

intercompanyRouter.post('/entities', async (req: Request, res: Response) => {
  try {
    const entity = LegalEntity.create(
      req.body.tenantId,
      req.body.name,
      req.body.baseCurrency,
      req.body.taxIdentifier
    );
    if (!(prisma as any).legalEntityModel) {
      return res.status(201).json(entity);
    }

    await (prisma as any).legalEntityModel.create({
      data: {
        id: entity.id,
        tenantId: entity.tenantId,
        name: entity.name,
        baseCurrency: entity.baseCurrency,
        taxIdentifier: entity.taxIdentifier,
        createdAt: entity.createdAt
      }
    });

    res.status(201).json(entity);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

intercompanyRouter.get('/entities/:tenantId', async (req: Request, res: Response) => {
  try {
    if (!(prisma as any).legalEntityModel) {
      return res.json([]);
    }

    const entities = await (prisma as any).legalEntityModel.findMany({
      where: { tenantId: req.params.tenantId }
    });
    res.json(entities);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

intercompanyRouter.post('/transfers', async (req: Request, res: Response) => {
  try {
    const {
      tenantId,
      fromEntityId,
      toEntityId,
      sku,
      quantity,
      unitCostCents,
      markupPercentage,
      dutyCents
    } = req.body;

    const result = transferService.executeTransfer(
      tenantId,
      fromEntityId,
      toEntityId,
      sku,
      quantity,
      unitCostCents,
      markupPercentage,
      dutyCents
    );

    await transferRepo.saveTransferWithJournals(
      result.transfer,
      result.standardJournal,
      result.eliminationJournal
    );

    res.status(201).json({
      transferId: result.transfer.id,
      standardJournalId: result.standardJournal.id,
      eliminationJournalId: result.eliminationJournal.id
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

intercompanyRouter.get('/transfers/:tenantId', async (req: Request, res: Response) => {
  try {
    const transfers = await transferRepo.getTransfersByTenant(req.params.tenantId);
    res.json(transfers);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});
