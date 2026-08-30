import { PrismaClient, NotificationModel, NotificationPreferenceModel } from '@prisma/client';

export class NotificationPrismaRepository {
  constructor(private prisma: PrismaClient) {}

  public async getUnread(tenantId: string): Promise<NotificationModel[]> {
    return this.prisma.notificationModel.findMany({
      where: {
        tenantId,
        isRead: false
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  public async markAsRead(id: string): Promise<void> {
    await this.prisma.notificationModel.update({
      where: { id },
      data: { isRead: true }
    });
  }

  public async savePreferences(prefs: Omit<NotificationPreferenceModel, 'id' | 'createdAt'>): Promise<NotificationPreferenceModel> {
    return this.prisma.notificationPreferenceModel.upsert({
      where: {
        userId_channel_eventType: {
          userId: prefs.userId,
          channel: prefs.channel,
          eventType: prefs.eventType
        }
      },
      update: {
        isEnabled: prefs.isEnabled
      },
      create: prefs
    });
  }
}
