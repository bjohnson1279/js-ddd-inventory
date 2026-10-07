import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../database/prisma';
import { CycleCountPrismaRepository } from '../../repositories/CycleCountPrismaRepository';
import { CycleCountScheduler } from '../../../domain/cycleCount/CycleCountScheduler';
import { ABCClassificationService } from '../../../domain/cycleCount/ABCClassificationService';

export const cycleCountRouter: FastifyPluginAsync = async (fastify) => {


const repo = new CycleCountPrismaRepository(prisma as any);
const scheduler = new CycleCountScheduler();

cycleCountRouter.post('/plans', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const plan = await repo.savePlan({
      tenantId: request.body.tenantId,
      name: request.body.name,
      abcClassification: request.body.abcClassification,
      frequencyDays: request.body.frequencyDays,
      zone: request.body.zone || null,
      isActive: true,
    });
    reply.status(201).send(plan);
  } catch (error) {
    reply.status(500).send({ error: 'Failed to create plan' });
  }
});

cycleCountRouter.post('/schedule', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { tenantId } = request.body;
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

cycleCountRouter.post('/classify', (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { totalUsageValue, totalOrgValue, thresholds } = request.body;
    const abcService = new ABCClassificationService();
    const result = abcService.classifySku(totalUsageValue, totalOrgValue, thresholds);
    const frequency = abcService.getRecommendedFrequency(result);
    reply.status(200).send({ class: result, frequencyDays: frequency });
  } catch (error) {
    reply.status(500).send({ error: 'Failed to classify' });
  }
});



};
