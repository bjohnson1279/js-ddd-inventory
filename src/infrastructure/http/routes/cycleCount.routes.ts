import { Router, Request, Response } from 'express';
import { prisma } from '../../database/prisma';
import { CycleCountPrismaRepository } from '../../repositories/CycleCountPrismaRepository';
import { CycleCountScheduler } from '../../../domain/cycleCount/CycleCountScheduler';
import { ABCClassificationService } from '../../../domain/cycleCount/ABCClassificationService';

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
    
    // In a real system, query CycleCountRecordModel for last execution dates.
    const audits = scheduler.generateAudits(plans, {});
    
    // Persist audits
    for (const audit of audits) {
      await repo.saveRecord(audit);
    }
    
    res.status(200).json({ scheduled: audits.length, audits });
  } catch (error) {
    res.status(500).json({ error: 'Failed to schedule cycle counts' });
  }
});

cycleCountRouter.post('/classify', (req: Request, res: Response) => {
  try {
    const { totalUsageValue, totalOrgValue, thresholds } = req.body;
    const abcService = new ABCClassificationService();
    const result = abcService.classifySku(totalUsageValue, totalOrgValue, thresholds);
    const frequency = abcService.getRecommendedFrequency(result);
    res.status(200).json({ class: result, frequencyDays: frequency });
  } catch (error) {
    res.status(500).json({ error: 'Failed to classify' });
  }
});


