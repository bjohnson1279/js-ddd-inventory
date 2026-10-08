import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../database/prisma';
import { NotificationPrismaRepository } from '../../repositories/NotificationPrismaRepository';

export const notificationRouter: FastifyPluginAsync = async (fastify) => {

const repo = new NotificationPrismaRepository(prisma as any);

fastify.get('/:tenantId', async (request: any, reply: any) => {
  try {
    const notifications = await repo.getUnread((request.params as any).tenantId);
    reply.status(200).send(notifications);
  } catch (error) {
    reply.status(500).send({ error: 'Failed to fetch notifications' });
  }
});

fastify.patch('/:id/read', async (request: any, reply: any) => {
  try {
    await repo.markAsRead((request.params as any).id);
    reply.status(200).send();
  } catch (error) {
    reply.status(500).send({ error: 'Failed to mark notification as read' });
  }
});

fastify.post('/preferences', async (request: any, reply: any) => {
  try {
    const prefs = await repo.savePreferences({
      userId: (request.body as any).userId,
      tenantId: (request.body as any).tenantId,
      channel: (request.body as any).channel,
      eventType: (request.body as any).eventType,
      isEnabled: (request.body as any).isEnabled
    });
    reply.status(201).send(prefs);
  } catch (error) {
    reply.status(500).send({ error: 'Failed to save preferences' });
  }
});



};

export default notificationRouter;
