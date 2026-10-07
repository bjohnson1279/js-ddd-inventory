import { Notification } from './Notification';

export class NotificationAggregator {
  public aggregate(events: any[]): Notification[] {
    const notifications: Notification[] = [];
    
    for (const event of events) {
      if (event.type === 'LOW_STOCK') {
        notifications.push({
          id: crypto.randomUUID(),
          tenantId: event.tenantId,
          title: 'Low Stock Alert',
          message: `SKU ${event.sku} is below reorder point.`,
          type: 'warning',
          isRead: false,
          createdAt: new Date()
        });
      } else if (event.type === 'WEBHOOK_FAILURE') {
        notifications.push({
          id: crypto.randomUUID(),
          tenantId: event.tenantId,
          title: 'Webhook Delivery Failed',
          message: `Delivery to ${event.url} failed after 3 attempts.`,
          type: 'error',
          isRead: false,
          createdAt: new Date()
        });
      }
    }
    
    return notifications;
  }
}
