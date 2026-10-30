import request from 'supertest';
import fastify from "fastify";
import { supplierRouter } from '../../../src/infrastructure/http/routes/supplier.routes';
import { randomUUID } from "crypto";

const asnStore = new Map<string, any>();
const scorecardStore = new Map<string, any>();

jest.mock('../../../src/infrastructure/database/prisma', () => ({
  prisma: {
    supplierASN: {
      deleteMany: jest.fn(async () => { asnStore.clear(); }),
      create: jest.fn(async (args: any) => {
        const item = { id: randomUUID(), createdAt: new Date(), ...args.data };
        asnStore.set(item.id, item);
        return item;
      }),
      findMany: jest.fn(async (args: any) => {
        return Array.from(asnStore.values()).filter(a => a.supplierId === args?.where?.supplierId);
      }),
    },
    supplierScorecard: {
      deleteMany: jest.fn(async () => { scorecardStore.clear(); }),
      create: jest.fn(async (args: any) => {
        const item = { id: randomUUID(), evaluatedAt: new Date(), ...args.data };
        scorecardStore.set(item.id, item);
        return item;
      }),
    },
    $disconnect: jest.fn(),
  },
}));

const app = fastify();
app.register(supplierRouter, { prefix: '/api/supplier' });

describe('SupplierPortal E2E', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    asnStore.clear();
    scorecardStore.clear();
    jest.clearAllMocks();
  });

  it('should create an ASN', async () => {
    const res = await request((app as any).server)
      .post('/api/supplier/asn')
      .send({
        asnNumber: 'ASN-1234',
        supplierId: 'SUP-1',
        expectedDelivery: new Date().toISOString(),
      });
    
    expect(res.status).toBe(201);
    expect(res.body.asnNumber).toBe('ASN-1234');
  });

  it('should get a scorecard', async () => {
    const res = await request((app as any).server)
      .get('/api/supplier/scorecard/SUP-1');
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('onTimeRate');
  });
});
