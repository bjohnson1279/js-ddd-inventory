import Fastify from 'fastify';
import request from 'supertest';
import { AccountingController } from '../AccountingController';
import { prisma } from '../../../database/prisma';
import { cycleCountRouter } from '../../routes/cycleCount.routes';
import anomalyDetectionRoutes from '../../routes/anomalyDetection.routes';
import rebalanceRoutes from '../../routes/rebalance.routes';

describe('Express conformance routes and controller coverage', () => {
  const makeReply = () => {
    const res: any = { statusCode: 200, body: undefined };
    res.status = jest.fn((code: number) => {
      res.statusCode = code;
      return res;
    });
    res.send = jest.fn((payload: any) => {
      res.body = payload;
      return res;
    });
    return res;
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('AccountingController.createJournal validates balanced entries and persists', async () => {
    const saveMock = jest.fn().mockResolvedValue(undefined);
    const server = { journalRepository: { save: saveMock } };

    // Missing lines -> 400
    const replyEmpty = makeReply();
    await AccountingController.createJournal({ server, tenantId: 't-acc', body: { description: 'Empty', lines: [] } }, replyEmpty);
    expect(replyEmpty.statusCode).toBe(400);

    // Invalid amount/type -> 400
    const replyBadLine = makeReply();
    await AccountingController.createJournal({
      server,
      tenantId: 't-acc',
      body: { description: 'Bad', lines: [{ accountCode: '1000', amountCents: -5, type: 'debit' }] },
    }, replyBadLine);
    expect(replyBadLine.statusCode).toBe(400);

    // Unbalanced -> 400
    const replyUnbalanced = makeReply();
    await AccountingController.createJournal({
      server,
      tenantId: 't-acc',
      body: {
        description: 'Unbalanced',
        lines: [
          { accountCode: '1000', amountCents: 100, type: 'debit' },
          { accountCode: '2000', amountCents: 50, type: 'credit' },
        ],
      },
    }, replyUnbalanced);
    expect(replyUnbalanced.statusCode).toBe(400);

    // Balanced -> 201
    const replyValid = makeReply();
    await AccountingController.createJournal({
      server,
      tenantId: 't-acc',
      body: {
        description: 'Balanced',
        lines: [
          { accountCode: '1000', amountCents: 500, type: 'debit', memo: 'd' },
          { accountCode: '2000', amountCents: 500, type: 'credit', memo: 'c' },
        ],
      },
    }, replyValid);
    expect(replyValid.statusCode).toBe(201);
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(replyValid.body.lines).toHaveLength(2);
  });

  test('AccountingController.getValuationReport computes FIFO, LIFO, and WAC', async () => {
    jest.spyOn(prisma.inventoryModel, 'findMany').mockResolvedValue([
      { sku: 'SKU-VAL', quantity: 15, locationId: 'default' },
    ] as any);
    jest.spyOn(prisma.productVariantModel, 'findUnique').mockResolvedValue({
      id: 'var-val',
      sku: 'SKU-VAL',
    } as any);
    jest.spyOn(prisma.inventoryCostLayerModel, 'findMany').mockResolvedValue([
      { variantId: 'var-val', originalQuantity: 10, remainingQuantity: 5, unitCostCents: 100, receivedAt: new Date('2026-01-01T00:00:00Z') },
      { variantId: 'var-val', originalQuantity: 10, remainingQuantity: 10, unitCostCents: 300, receivedAt: new Date('2026-01-02T00:00:00Z') },
    ] as any);

    for (const [method, expected] of [['FIFO', 3500], ['LIFO', 2500], ['WAC', 3000], ['WEIGHTED_AVERAGE_COST', 3000]] as const) {
      const req: any = { tenantId: 't-val', query: { method, locationId: 'default' } };
      const reply = makeReply();
      await AccountingController.getValuationReport(req, reply);
      expect(reply.statusCode).toBe(200);
      expect(reply.body[0].totalValueCents).toBe(expected);
    }
  });

  test('anomalyDetectionRoutes and rebalanceRoutes return fallback 200 schemas when sidecar is offline', async () => {
    const app = Fastify();
    app.decorateRequest('tenantId', 't-ai');
    await app.register(anomalyDetectionRoutes, { prefix: '/api/anomaly-detection' });
    await app.register(rebalanceRoutes, { prefix: '/api/rebalance' });
    await app.ready();

    const anomRes = await request(app.server).get('/api/anomaly-detection/analyze');
    expect(anomRes.status).toBe(200);
    expect(Array.isArray(anomRes.body.alerts)).toBe(true);

    const rebRes = await request(app.server).get('/api/rebalance/matrix');
    expect(rebRes.status).toBe(200);
    expect(Array.isArray(rebRes.body.recommendations)).toBe(true);

    await app.close();
  });

  test('cycleCountRoutes start, list, and submit cycle counts in memory fallback', async () => {
    const app = Fastify();
    app.decorateRequest('tenantId', 't-cc');
    await app.register(cycleCountRouter, { prefix: '/api/cycle-counts' });
    await app.ready();

    const startRes = await request(app.server)
      .post('/api/cycle-counts/start')
      .send({ name: 'Unit Count', locationId: 'default', isBlindCount: false });
    expect([200, 201]).toContain(startRes.status);
    const id = startRes.body.id;
    expect(id).toBeDefined();

    const listRes = await request(app.server).get('/api/cycle-counts');
    expect(listRes.status).toBe(200);

    jest.spyOn(prisma.inventoryModel, 'updateMany').mockResolvedValue({ count: 1 } as any);
    const submitRes = await request(app.server)
      .post('/api/cycle-counts/submit')
      .send({ id, countedLines: [{ sku: 'SKU-CC', locationId: 'default', countedQuantity: 8 }] });
    expect(submitRes.status).toBe(200);

    await app.close();
  });
});
