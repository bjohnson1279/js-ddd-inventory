import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../database/prisma';
import { NotificationPrismaRepository } from '../../repositories/NotificationPrismaRepository';

export const notificationRouter: FastifyPluginAsync = async (fastify) => {

const repo = new NotificationPrismaRepository(prisma as any);

notificationRouter.get('/:tenantId', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const notifications = await repo.getUnread(request.params.tenantId);
    reply.status(200).send(notifications);
  } catch (error) {
    reply.status(500).send({ error: 'Failed to fetch notifications' });
  }
});

notificationRouter.patch('/:id/read', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await repo.markAsRead(request.params.id);
    reply.status(200).send();
  } catch (error) {
    reply.status(500).send({ error: 'Failed to mark notification as read' });
  }
});

notificationRouter.post('/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const prefs = await repo.savePreferences({
      userId: request.body.userId,
      tenantId: request.body.tenantId,
      channel: request.body.channel,
      eventType: request.body.eventType,
      isEnabled: request.body.isEnabled
    });
    reply.status(201).send(prefs);
  } catch (error) {
    reply.status(500).send({ error: 'Failed to save preferences' });
  }
});

export default notificationRouter;

};
