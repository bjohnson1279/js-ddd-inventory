import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';

export const supplierPortalRouter: FastifyPluginAsync = async (fastify) => {


fastify.post('/asn', (request: any, reply: any) => {
  reply.send({ id: 'asn-123', status: 'SUBMITTED' });
});

fastify.get('/asn', (request: any, reply: any) => {
  reply.send([]);
});

};
