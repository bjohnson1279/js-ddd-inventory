import { Router, Request, Response } from 'express';
import { prisma } from '../../database/prisma';
import { NotificationPrismaRepository } from '../../repositories/NotificationPrismaRepository';

export const notificationRouter = Router();
const repo = new NotificationPrismaRepository(prisma as any);

notificationRouter.get('/:tenantId', async (req: Request, res: Response) => {
  try {
    const notifications = await repo.getUnread(req.params.tenantId);
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

notificationRouter.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    await repo.markAsRead(req.params.id);
    res.status(200).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

notificationRouter.post('/preferences', async (req: Request, res: Response) => {
  try {
    const prefs = await repo.savePreferences({
      userId: req.body.userId,
      tenantId: req.body.tenantId,
      channel: req.body.channel,
      eventType: req.body.eventType,
      isEnabled: req.body.isEnabled
    });
    res.status(201).json(prefs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

export default notificationRouter;
