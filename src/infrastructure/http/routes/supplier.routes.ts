import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../database/prisma';
import { SupplierPrismaRepository } from '../../repositories/SupplierPrismaRepository';
import { SupplierOTIFCalculator } from '../../../domain/supplier/SupplierOTIFCalculator';
import { ASN } from '../../../domain/supplier/ASN';

export const supplierRouter: FastifyPluginAsync = async (fastify) => {

const repo = new SupplierPrismaRepository(prisma as any);
const calculator = new SupplierOTIFCalculator();

supplierRouter.post('/asn', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const asn = await repo.saveASN({
      asnNumber: request.body.asnNumber,
      supplierId: request.body.supplierId,
      expectedDelivery: new Date(request.body.expectedDelivery),
      actualDelivery: request.body.actualDelivery ? new Date(request.body.actualDelivery) : null,
      status: request.body.status || 'IN_TRANSIT',
    });
    reply.status(201).send(asn);
  } catch (error) {
    console.error('Supplier route error:', error);
    reply.status(500).send({ error: 'Failed to create ASN' });
  }
});

supplierRouter.get('/scorecard/:supplierId', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { supplierId } = request.params;
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
