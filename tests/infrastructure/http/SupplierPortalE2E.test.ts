import request from 'supertest';
import fastify from "fastify";
import { supplierRouter } from '../../../src/infrastructure/http/routes/supplier.routes';

const app = fastify();

app.register(supplierRouter, { prefix: '/api/supplier' });


import { prisma } from '../../../src/infrastructure/database/prisma';

describe('SupplierPortal E2E', () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(async () => {
    try {
      await prisma.supplierASN.deleteMany();
    } catch (e) {}
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
  it('should create an ASN', async () => {
    const res = await request((app as any).server)
      .post('/api/supplier/asn')
      .send({
        asnNumber: 'ASN-1234',
        supplierId: 'SUP-1',
        expectedDelivery: new Date().toISOString(),
      });
    
    if (res.status !== 201) {
      console.log(res.body);
    }
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
