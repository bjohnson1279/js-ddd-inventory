import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../database/prisma';
import { CycleCountPrismaRepository } from '../../repositories/CycleCountPrismaRepository';
import { CycleCountScheduler } from '../../../domain/cycleCount/CycleCountScheduler';
import { ABCClassificationService } from '../../../domain/cycleCount/ABCClassificationService';
import { RedisCacheService } from '../../cache/RedisCacheService';
import crypto from 'crypto';

export const cycleCountRouter: FastifyPluginAsync = async (fastify) => {


const repo = new CycleCountPrismaRepository(prisma as any);
const scheduler = new CycleCountScheduler();
const inMemoryCycleCounts = new Map<string, any>();

fastify.get('/', async (request: any, reply: any) => {
  try {
    const tenantId = request.tenantId || (request.query as any)?.tenantId || 'DEFAULT';
    try {
      const records = await (prisma as any).cycleCountRecordModel.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
      if (records.length > 0) return reply.status(200).send(records);
    } catch {}
    const local = Array.from(inMemoryCycleCounts.values()).filter(r => r.tenantId === tenantId);
    reply.status(200).send(local);
  } catch (error) {
    reply.status(500).send({ error: 'Failed to list cycle counts' });
  }
});

fastify.post('/start', async (request: any, reply: any) => {
  try {
    const body = (request.body as any) || {};
    const tenantId = body.tenantId || request.tenantId || 'DEFAULT';
    const record = {
      id: crypto.randomUUID(),
      tenantId,
      name: body.name || 'Cycle Count',
      status: 'PENDING',
      abcClassification: body.abcClassification || 'A',
      zone: body.zone || null,
      isBlindCount: Boolean(body.isBlindCount),
      createdAt: new Date().toISOString(),
    };
    inMemoryCycleCounts.set(record.id, record);
    try {
      await (prisma as any).cycleCountRecordModel.create({
        data: {
          id: record.id,
          tenantId: record.tenantId,
          name: record.name,
          status: record.status,
          abcClassification: record.abcClassification,
          zone: record.zone,
          isBlindCount: record.isBlindCount,
        },
      });
    } catch {}
    reply.status(201).send(record);
  } catch (error) {
    reply.status(500).send({ error: 'Failed to start cycle count' });
  }
});

fastify.post('/submit', async (request: any, reply: any) => {
  try {
    const body = (request.body as any) || {};
    const lines = Array.isArray(body.countedLines) ? body.countedLines : [];
    const tenantId = body.tenantId || request.tenantId || 'DEFAULT';
    for (const line of lines) {
      const sku = line.sku;
      const countedQty = Number(line.countedQuantity);
      const locationId = line.locationId || 'default';
      if (sku && !Number.isNaN(countedQty)) {
        await prisma.inventoryModel.updateMany({
          where: { sku, locationId },
          data: { quantity: countedQty, version: { increment: 1 } },
        });
      }
    }
    RedisCacheService.getInstance().invalidatePattern(`stock:${tenantId}:*`);
    if (body.id) {
      const mem = inMemoryCycleCounts.get(body.id);
      if (mem) mem.status = 'COMPLETED';
      try {
        await (prisma as any).cycleCountRecordModel.updateMany({
          where: { id: body.id },
          data: { status: 'COMPLETED' },
        });
      } catch {}
    }
    reply.status(200).send({ id: body.id, status: 'COMPLETED' });
  } catch (error) {
    reply.status(500).send({ error: 'Failed to submit cycle count' });
  }
});

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
