import { Router, Request, Response } from 'express';
import { prisma } from '../../database/prisma';
import { CycleCountPrismaRepository } from '../../repositories/CycleCountPrismaRepository';
import { CycleCountScheduler } from '../../../domain/cycleCount/CycleCountScheduler';

export const cycleCountRouter = Router();
const repo = new CycleCountPrismaRepository(prisma as any);
const scheduler = new CycleCountScheduler();

cycleCountRouter.post('/plans', async (req: Request, res: Response) => {
  try {
    const plan = await repo.savePlan({
      tenantId: req.body.tenantId,
      name: req.body.name,
      abcClassification: req.body.abcClassification,
      frequencyDays: req.body.frequencyDays,
      zone: req.body.zone || null,
      isActive: true,
    });
    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

cycleCountRouter.post('/schedule', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;
    const plans = await repo.getActivePlans(tenantId);
    // Dummy last counts
    const audits = scheduler.generateAudits(plans, {});
    // Persist audits would go here (e.g. mapping to InventoryAuditModel)
    res.status(200).json({ scheduled: audits.length, audits });
  } catch (error) {
    res.status(500).json({ error: 'Failed to schedule cycle counts' });
  }
});
