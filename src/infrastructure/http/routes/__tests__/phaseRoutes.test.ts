import { prisma } from '../../../database/prisma';
import { agingRouter } from '../aging.routes';
import { cycleCountRouter } from '../cycleCount.routes';
import { intercompanyRouter } from '../intercompany.routes';
import { supplierPortalRouter } from '../supplierPortal.routes';
import anomalyDetectionRouter from '../anomalyDetection.routes';
import rebalanceRouter from '../rebalance.routes';
import { CycleCountPrismaRepository } from '../../../repositories/CycleCountPrismaRepository';
import { PrismaIntercompanyRepository } from '../../../database/PrismaIntercompanyRepository';
import { AnomalyDetectionService } from '../../../../domain/services/AnomalyDetectionService';
import { RebalanceOptimizationService } from '../../../../domain/services/RebalanceOptimizationService';

type Handler = (req: any, reply: any) => any;

async function registerRoutes(plugin: any): Promise<Record<string, Handler>> {
  const routes: Record<string, Handler> = {};
  const fakeFastify = {
    get: (path: string, handler: Handler) => {
      routes[`GET ${path}`] = handler;
    },
    post: (path: string, handler: Handler) => {
      routes[`POST ${path}`] = handler;
    },
  };
  await plugin(fakeFastify, {});
  return routes;
}

function makeReply() {
  const res = { statusCode: 200, body: undefined as any };
  const reply: any = {
    status: jest.fn((code: number): any => {
      res.statusCode = code;
      return reply;
    }),
    send: jest.fn((payload: any): any => {
      res.body = payload;
      return reply;
    }),
  };
  return { reply, res };
}

describe('Express/Fastify Phase 15-19 Route Plugins', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('agingRouter', () => {
    it('handles aging report success and 500 error', async () => {
      const routes = await registerRoutes(agingRouter);
      const findMany = jest.fn().mockResolvedValue([
        { variantId: 'SKU-1', remainingQuantity: 10, unitCostCents: 100, receivedAt: new Date() },
      ]);
      (prisma as any).inventoryCostLayerModel = { findMany, groupBy: jest.fn() };

      const { reply, res } = makeReply();
      await routes['GET /report/:tenantId']({ params: { tenantId: 't1' } }, reply);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ buckets: [], totalValueCents: 0 });

      findMany.mockRejectedValueOnce(new Error('db down'));
      const errCall = makeReply();
      await routes['GET /report/:tenantId']({ params: { tenantId: 't1' } }, errCall.reply);
      expect(errCall.res.statusCode).toBe(500);
    });

    it('handles dead-stock default days, custom days, invalid days (400), and 500 error', async () => {
      const routes = await registerRoutes(agingRouter);
      const groupBy = jest.fn().mockResolvedValue([{ variantId: 'SKU-1' }]);
      const dispatchFindMany = jest.fn().mockResolvedValue([]);
      (prisma as any).inventoryCostLayerModel = { findMany: jest.fn(), groupBy };
      (prisma as any).dispatchRecordModel = { findMany: dispatchFindMany };

      const rDefault = makeReply();
      await routes['GET /dead-stock/:tenantId']({ params: { tenantId: 't1' }, query: {} }, rDefault.reply);
      expect(rDefault.res.statusCode).toBe(200);
      expect(rDefault.res.body.periodDays).toBe(180);

      const rCustom = makeReply();
      await routes['GET /dead-stock/:tenantId']({ params: { tenantId: 't1' }, query: { days: '90' } }, rCustom.reply);
      expect(rCustom.res.statusCode).toBe(200);
      expect(rCustom.res.body.periodDays).toBe(90);

      const rBad = makeReply();
      await routes['GET /dead-stock/:tenantId']({ params: { tenantId: 't1' }, query: { days: 90 } }, rBad.reply);
      expect(rBad.res.statusCode).toBe(400);

      groupBy.mockRejectedValueOnce(new Error('db error'));
      const rErr = makeReply();
      await routes['GET /dead-stock/:tenantId']({ params: { tenantId: 't1' }, query: {} }, rErr.reply);
      expect(rErr.res.statusCode).toBe(500);
    });
  });

  describe('cycleCountRouter', () => {
    it('starts, lists, submits, creates plans, schedules audits, and classifies ABC', async () => {
      const routes = await registerRoutes(cycleCountRouter);
      (prisma as any).cycleCountRecordModel = {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      };
      (prisma as any).inventoryModel = {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      };

      // Start cycle count
      const started = makeReply();
      await routes['POST /start'](
        { tenantId: 't-cc', body: { name: 'Q4 Audit', abcClassification: 'A', isBlindCount: true } },
        started.reply,
      );
      expect(started.res.statusCode).toBe(201);
      const countId = started.res.body.id;

      // List falls back to in-memory when DB returns []
      const listed = makeReply();
      await routes['GET /']({ tenantId: 't-cc', query: {} }, listed.reply);
      expect(listed.res.statusCode).toBe(200);
      expect(listed.res.body.some((r: any) => r.id === countId)).toBe(true);

      // List returns DB rows when non-empty
      (prisma as any).cycleCountRecordModel.findMany.mockResolvedValueOnce([{ id: 'db-1', tenantId: 't-cc' }]);
      const listedDb = makeReply();
      await routes['GET /']({ tenantId: 't-cc', query: {} }, listedDb.reply);
      expect(listedDb.res.body).toEqual([{ id: 'db-1', tenantId: 't-cc' }]);

      // Submit cycle count
      const submitted = makeReply();
      await routes['POST /submit'](
        {
          tenantId: 't-cc',
          body: { id: countId, countedLines: [{ sku: 'SKU-1', countedQuantity: 15, locationId: 'loc-1' }] },
        },
        submitted.reply,
      );
      expect(submitted.res.statusCode).toBe(200);
      expect(submitted.res.body.status).toBe('COMPLETED');

      // Plans
      jest.spyOn(CycleCountPrismaRepository.prototype, 'savePlan').mockResolvedValue({ id: 'plan-1' } as any);
      const planned = makeReply();
      await routes['POST /plans'](
        { body: { tenantId: 't-cc', name: 'Class A', abcClassification: 'A', frequencyDays: 30 } },
        planned.reply,
      );
      expect(planned.res.statusCode).toBe(201);

      // Schedule
      jest.spyOn(CycleCountPrismaRepository.prototype, 'getActivePlans').mockResolvedValue([]);
      jest.spyOn(CycleCountPrismaRepository.prototype, 'saveRecord').mockResolvedValue({} as any);
      const scheduled = makeReply();
      await routes['POST /schedule']({ body: { tenantId: 't-cc' } }, scheduled.reply);
      expect(scheduled.res.statusCode).toBe(200);
      expect(scheduled.res.body.scheduled).toBe(0);

      // Classify
      const classified = makeReply();
      routes['POST /classify'](
        { body: { totalUsageValue: 900, totalOrgValue: 1000 } },
        classified.reply,
      );
      expect(classified.res.statusCode).toBe(200);
      expect(classified.res.body.class).toBeDefined();
    });
  });

  describe('intercompanyRouter', () => {
    it('creates and lists legal entities and executes/lists intercompany transfers', async () => {
      const routes = await registerRoutes(intercompanyRouter);

      // Without legalEntityModel on prisma -> graceful fallback
      Object.defineProperty(prisma, 'legalEntityModel', { value: undefined, configurable: true, writable: true });
      const entFallback = makeReply();
      await routes['POST /entities'](
        { body: { tenantId: 't-ic', name: 'US Corp', baseCurrency: 'USD', taxIdentifier: '12-345' } },
        entFallback.reply,
      );
      expect(entFallback.res.statusCode).toBe(201);

      const listFallback = makeReply();
      await routes['GET /entities/:tenantId']({ params: { tenantId: 't-ic' } }, listFallback.reply);
      expect(listFallback.res.body).toEqual([]);

      // With legalEntityModel on prisma
      Object.defineProperty(prisma, 'legalEntityModel', {
        value: {
          create: jest.fn().mockResolvedValue({}),
          findMany: jest.fn().mockResolvedValue([{ id: 'e1', name: 'US Corp' }]),
        },
        configurable: true,
        writable: true,
      });
      const entDb = makeReply();
      await routes['POST /entities'](
        { body: { tenantId: 't-ic', name: 'EU GmbH', baseCurrency: 'EUR', taxIdentifier: 'DE-999' } },
        entDb.reply,
      );
      expect(entDb.res.statusCode).toBe(201);

      const listDb = makeReply();
      await routes['GET /entities/:tenantId']({ params: { tenantId: 't-ic' } }, listDb.reply);
      expect(listDb.res.body).toEqual([{ id: 'e1', name: 'US Corp' }]);

      // Transfers
      jest.spyOn(PrismaIntercompanyRepository.prototype, 'saveTransferWithJournals').mockResolvedValue(undefined);
      jest.spyOn(PrismaIntercompanyRepository.prototype, 'getTransfersByTenant').mockResolvedValue([{ id: 'tr-1' }] as any);

      const trCreate = makeReply();
      await routes['POST /transfers'](
        {
          body: {
            tenantId: 't-ic',
            fromEntityId: 'e1',
            toEntityId: 'e2',
            sku: 'SKU-1',
            quantity: 5,
            unitCostCents: 1000,
            markupPercentage: 10,
            dutyCents: 50,
          },
        },
        trCreate.reply,
      );
      expect(trCreate.res.statusCode).toBe(201);
      expect(trCreate.res.body.transferId).toBeDefined();

      const trList = makeReply();
      await routes['GET /transfers/:tenantId']({ params: { tenantId: 't-ic' } }, trList.reply);
      expect(trList.res.body).toEqual([{ id: 'tr-1' }]);

      // Error branch returns 400
      jest.spyOn(PrismaIntercompanyRepository.prototype, 'getTransfersByTenant').mockRejectedValueOnce(new Error('fail'));
      const trErr = makeReply();
      await routes['GET /transfers/:tenantId']({ params: { tenantId: 't-ic' } }, trErr.reply);
      expect(trErr.res.statusCode).toBe(400);
    });
  });

  describe('supplierPortalRouter', () => {
    it('handles POST and GET /asn', async () => {
      const routes = await registerRoutes(supplierPortalRouter);
      const rPost = makeReply();
      routes['POST /asn']({}, rPost.reply);
      expect(rPost.res.body).toEqual({ id: 'asn-123', status: 'SUBMITTED' });

      const rGet = makeReply();
      routes['GET /asn']({}, rGet.reply);
      expect(rGet.res.body).toEqual([]);
    });
  });

  describe('anomalyDetectionRouter and rebalanceRouter', () => {
    it('returns analysis/matrix on success and safe empty fallback on service errors', async () => {
      const anomRoutes = await registerRoutes(anomalyDetectionRouter);
      jest.spyOn(AnomalyDetectionService.prototype, 'analyze').mockResolvedValueOnce({ alerts: [{ id: 'a1' }] } as any);
      const aOk = makeReply();
      await anomRoutes['GET /analyze']({ user: { tenantId: 't-anom' } }, aOk.reply);
      expect(aOk.res.body).toEqual({ alerts: [{ id: 'a1' }] });

      jest.spyOn(AnomalyDetectionService.prototype, 'analyze').mockRejectedValueOnce(new Error('sidecar down'));
      const aFallback = makeReply();
      await anomRoutes['GET /analyze']({}, aFallback.reply);
      expect(aFallback.res.statusCode).toBe(200);
      expect(aFallback.res.body.alerts).toEqual([]);

      const rebRoutes = await registerRoutes(rebalanceRouter);
      jest.spyOn(RebalanceOptimizationService.prototype, 'optimize').mockResolvedValueOnce({ recommendations: [{ id: 'r1' }] } as any);
      const rOk = makeReply();
      await rebRoutes['GET /matrix']({ user: { tenantId: 't-reb' } }, rOk.reply);
      expect(rOk.res.body).toEqual({ recommendations: [{ id: 'r1' }] });

      jest.spyOn(RebalanceOptimizationService.prototype, 'optimize').mockRejectedValueOnce(new Error('sidecar down'));
      const rFallback = makeReply();
      await rebRoutes['GET /matrix']({}, rFallback.reply);
      expect(rFallback.res.statusCode).toBe(200);
      expect(rFallback.res.body.recommendations).toEqual([]);
    });
  });
});
