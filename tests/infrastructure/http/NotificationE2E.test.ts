import request from 'supertest';
import fastify from "fastify";
import { notificationRouter } from '../../../src/infrastructure/http/routes/notification.routes';
import { randomUUID } from "crypto";

const notificationStore = new Map<string, any>();
const preferenceStore = new Map<string, any>();

jest.mock('../../../src/infrastructure/database/prisma', () => ({
  prisma: {
    notificationModel: {
      findMany: jest.fn(async (args: any) => {
        return Array.from(notificationStore.values()).filter(
          n => n.tenantId === args.where.tenantId && n.isRead === args.where.isRead
        );
      }),
      update: jest.fn(async (args: any) => {
        const item = notificationStore.get(args.where.id) || {};
        const updated = { ...item, ...args.data };
        notificationStore.set(args.where.id, updated);
        return updated;
      }),
    },
    notificationPreferenceModel: {
      upsert: jest.fn(async (args: any) => {
        const key = `${args.create.userId}_${args.create.channel}_${args.create.eventType}`;
        const item = { id: randomUUID(), createdAt: new Date(), ...args.create, ...args.update };
        preferenceStore.set(key, item);
        return item;
      }),
    },
    $disconnect: jest.fn(),
  },
}));

const app = fastify();
app.register(notificationRouter, { prefix: '/api/notifications' });

describe('Notification E2E', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    notificationStore.clear();
    preferenceStore.clear();
    jest.clearAllMocks();
  });

  it('should fetch unread notifications', async () => {
    notificationStore.set('n1', { id: 'n1', tenantId: 'tenant-1', title: 'Alert', message: 'Low stock', isRead: false });

    const res = await request((app as any).server)
      .get('/api/notifications/tenant-1');
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });

  it('should mark notification as read', async () => {
    notificationStore.set('n1', { id: 'n1', tenantId: 'tenant-1', title: 'Alert', message: 'Low stock', isRead: false });

    const res = await request((app as any).server)
      .patch('/api/notifications/n1/read');
    
    expect(res.status).toBe(200);
    expect(notificationStore.get('n1').isRead).toBe(true);
  });

  it('should save preferences', async () => {
    const res = await request((app as any).server)
      .post('/api/notifications/preferences')
      .send({
        userId: 'user-1',
        tenantId: 'tenant-1',
        channel: 'EMAIL',
        eventType: 'LOW_STOCK',
        isEnabled: true
      });
    
    expect(res.status).toBe(201);
  });
});
