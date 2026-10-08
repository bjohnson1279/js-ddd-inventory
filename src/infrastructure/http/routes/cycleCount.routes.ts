import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../database/prisma';
import { CycleCountPrismaRepository } from '../../repositories/CycleCountPrismaRepository';
import { CycleCountScheduler } from '../../../domain/cycleCount/CycleCountScheduler';
import { ABCClassificationService } from '../../../domain/cycleCount/ABCClassificationService';

export const cycleCountRouter: FastifyPluginAsync = async (fastify) => {


const repo = new CycleCountPrismaRepository(prisma as any);
const scheduler = new CycleCountScheduler();

fastify.post('/plans', async (request: any, reply: any) => {
  try {
    const plan = await repo.savePlan({
      tenantId: (request.body as any).tenantId,
      name: (request.body as any).name,
      abcClassification: (request.body as any).abcClassification,
      frequencyDays: (request.body as any).frequencyDays,
      zone: (request.body as any).zone || null,
      isActive: true,
    });
    reply.status(201).send(plan);
  } catch (error) {
    reply.status(500).send({ error: 'Failed to create plan' });
  }
});

fastify.post('/schedule', async (request: any, reply: any) => {
  try {
    const { tenantId } = (request.body as any);
    const plans = await repo.getActivePlans(tenantId);
    
    // In a real system, query CycleCountRecordModel for last execution dates.
    const audits = scheduler.generateAudits(plans, {});
    
    // Persist audits
    for (const audit of audits) {
      await repo.saveRecord(audit);
    }
    
    reply.status(200).send({ scheduled: audits.length, audits });
  } catch (error) {
    reply.status(500).send({ error: 'Failed to schedule cycle counts' });
  }
});

fastify.post('/classify', (request: any, reply: any) => {
  try {
    const { totalUsageValue, totalOrgValue, thresholds } = (request.body as any);
    const abcService = new ABCClassificationService();
    const result = abcService.classifySku(totalUsageValue, totalOrgValue, thresholds);
    const frequency = abcService.getRecommendedFrequency(result);
    reply.status(200).send({ class: result, frequencyDays: frequency });
  } catch (error) {
    reply.status(500).send({ error: 'Failed to classify' });
  }
});



};
