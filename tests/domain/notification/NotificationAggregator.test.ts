import { NotificationAggregator } from '../../../src/domain/notification/NotificationAggregator';

describe('NotificationAggregator', () => {
  let aggregator: NotificationAggregator;

  beforeEach(() => {
    aggregator = new NotificationAggregator();
  });

  it('should aggregate LOW_STOCK events into warning notifications', () => {
    const events = [
      {
        type: 'LOW_STOCK',
        tenantId: 'tenant-123',
        sku: 'SKU-ABC'
      }
    ];

    const notifications = aggregator.aggregate(events);

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      tenantId: 'tenant-123',
      title: 'Low Stock Alert',
      message: 'SKU SKU-ABC is below reorder point.',
      type: 'warning',
      isRead: false
    });
    expect(notifications[0].id).toBeDefined();
    expect(notifications[0].createdAt).toBeInstanceOf(Date);
  });

  it('should aggregate WEBHOOK_FAILURE events into error notifications', () => {
    const events = [
      {
        type: 'WEBHOOK_FAILURE',
        tenantId: 'tenant-456',
        url: 'https://example.com/webhook'
      }
    ];

    const notifications = aggregator.aggregate(events);

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      tenantId: 'tenant-456',
      title: 'Webhook Delivery Failed',
      message: 'Delivery to https://example.com/webhook failed after 3 attempts.',
      type: 'error',
      isRead: false
    });
    expect(notifications[0].id).toBeDefined();
    expect(notifications[0].createdAt).toBeInstanceOf(Date);
  });

  it('should ignore unknown event types', () => {
    const events = [
      {
        type: 'UNKNOWN_TYPE',
        tenantId: 'tenant-789'
      }
    ];

    const notifications = aggregator.aggregate(events);

    expect(notifications).toHaveLength(0);
  });
});
