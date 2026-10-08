import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../database/prisma';
import { SupplierPrismaRepository } from '../../repositories/SupplierPrismaRepository';
import { SupplierOTIFCalculator } from '../../../domain/supplier/SupplierOTIFCalculator';
import { ASN } from '../../../domain/supplier/ASN';

export const supplierRouter: FastifyPluginAsync = async (fastify) => {

const repo = new SupplierPrismaRepository(prisma as any);
const calculator = new SupplierOTIFCalculator();

fastify.post('/asn', async (request: any, reply: any) => {
  try {
    const asn = await repo.saveASN({
      asnNumber: (request.body as any).asnNumber,
      supplierId: (request.body as any).supplierId,
      expectedDelivery: new Date((request.body as any).expectedDelivery),
      actualDelivery: (request.body as any).actualDelivery ? new Date((request.body as any).actualDelivery) : null,
      status: (request.body as any).status || 'IN_TRANSIT',
    });
    reply.status(201).send(asn);
  } catch (error) {
    console.error('Supplier route error:', error);
    reply.status(500).send({ error: 'Failed to create ASN' });
  }
});

fastify.get('/scorecard/:supplierId', async (request: any, reply: any) => {
  try {
    const { supplierId } = (request.params as any);
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
    
    reply.status(200).send(scorecard);
  } catch (error) {
    reply.status(500).send({ error: 'Failed to generate scorecard' });
  }
});

};
