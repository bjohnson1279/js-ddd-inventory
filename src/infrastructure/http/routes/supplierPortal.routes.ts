import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';

export const supplierPortalRouter: FastifyPluginAsync = async (fastify) => {


supplierPortalRouter.post('/asn', (request: FastifyRequest, reply: FastifyReply) => {
  reply.send({ id: 'asn-123', status: 'SUBMITTED' });
});

supplierPortalRouter.get('/asn', (request: FastifyRequest, reply: FastifyReply) => {
  reply.send([]);
});

};
