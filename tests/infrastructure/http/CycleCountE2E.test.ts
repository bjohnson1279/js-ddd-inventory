import request from 'supertest';
import fastify from "fastify";
import { cycleCountRouter } from '../../../src/infrastructure/http/routes/cycleCount.routes';
import { randomUUID } from "crypto";

const planStore = new Map<string, any>();
const auditStore = new Map<string, any>();

jest.mock('../../../src/infrastructure/database/prisma', () => ({
  prisma: {
    cycleCountPlanModel: {
      create: jest.fn(async (args: any) => {
        const item = { id: randomUUID(), createdAt: new Date(), ...args.data };
        planStore.set(item.id, item);
        return item;
      }),
      findMany: jest.fn(async (args: any) => {
        return Array.from(planStore.values()).filter(p => p.tenantId === args?.where?.tenantId && p.isActive === args?.where?.isActive);
      }),
    },
    inventoryAuditModel: {
      create: jest.fn(async (args: any) => {
        const item = { id: randomUUID(), createdAt: new Date(), ...args.data };
        auditStore.set(item.id, item);
        return item;
      }),
    },
    inventoryAuditItemModel: {
      createMany: jest.fn(async () => {}),
    },
    $disconnect: jest.fn(),
  },
}));

const app = fastify();
app.register(cycleCountRouter, { prefix: '/api/cycle-counts' });

describe('CycleCount E2E', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    planStore.clear();
    auditStore.clear();
    jest.clearAllMocks();
  });

  it('should create a cycle count plan', async () => {
    const res = await request((app as any).server)
      .post('/api/cycle-counts/plans')
      .send({
        tenantId: 'tenant-1',
        name: 'Daily A-Items',
        abcClassification: 'A',
        frequencyDays: 30
      });
    
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Daily A-Items');
  });

  it('should schedule cycle counts based on active plans', async () => {
    planStore.set('p1', { id: 'p1', tenantId: 'tenant-1', name: 'Daily A-Items', abcClassification: 'A', frequencyDays: 30, zone: 'ZONE-1', isActive: true });

    const res = await request((app as any).server)
      .post('/api/cycle-counts/schedule')
      .send({ tenantId: 'tenant-1' });
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('scheduled');
    expect(res.body).toHaveProperty('audits');
  });
});
