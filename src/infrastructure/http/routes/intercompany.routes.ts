import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../database/prisma';
import { IntercompanyTransferService } from '../../../domain/accounting/services/IntercompanyTransferService';
import { PrismaIntercompanyRepository } from '../../database/PrismaIntercompanyRepository';
import { LegalEntity } from '../../../domain/accounting/aggregates/LegalEntity';

export const intercompanyRouter: FastifyPluginAsync = async (fastify) => {

const transferService = new IntercompanyTransferService();
const transferRepo = new PrismaIntercompanyRepository();

fastify.post('/entities', async (request: any, reply: any) => {
  try {
    const entity = LegalEntity.create(
      (request.body as any).tenantId,
      (request.body as any).name,
      (request.body as any).baseCurrency,
      (request.body as any).taxIdentifier
    );
    if (!(prisma as any).legalEntityModel) {
      return reply.status(201).send(entity);
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

    reply.status(201).send(entity);
  } catch (error: any) {
    reply.status(400).send({ error: error.message });
  }
});

fastify.get('/entities/:tenantId', async (request: any, reply: any) => {
  try {
    if (!(prisma as any).legalEntityModel) {
      return reply.send([]);
    }

    const entities = await (prisma as any).legalEntityModel.findMany({
      where: { tenantId: (request.params as any).tenantId }
    });
    reply.send(entities);
  } catch (error: any) {
    reply.status(400).send({ error: error.message });
  }
});

fastify.post('/transfers', async (request: any, reply: any) => {
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
    } = (request.body as any);

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

    reply.status(201).send({
      transferId: result.transfer.id,
      standardJournalId: result.standardJournal.id,
      eliminationJournalId: result.eliminationJournal.id
    });
  } catch (error: any) {
    reply.status(400).send({ error: error.message });
  }
});

fastify.get('/transfers/:tenantId', async (request: any, reply: any) => {
  try {
    const transfers = await transferRepo.getTransfersByTenant((request.params as any).tenantId);
    reply.send(transfers);
  } catch (error: any) {
    reply.status(400).send({ error: error.message });
  }
});

};
