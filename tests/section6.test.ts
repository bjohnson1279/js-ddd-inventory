import { TenantConnectionRouter } from '../src/infrastructure/tenant/TenantConnectionRouter';
import { CRDTStockResolver } from '../src/domain/crdt/CRDTStockResolver';
import { RFIDBulkScanIngestionService } from '../src/application/iot/RFIDBulkScanIngestionService';
import { AutonomousInventoryEngine } from '../src/application/autonomous/AutonomousInventoryEngine';

describe('js-ddd-inventory Section 6 Feature Test Suite', () => {
  describe('TenantConnectionRouter', () => {
    it('should register and retrieve tenant Prisma instance', () => {
      const router = TenantConnectionRouter.getInstance();
      router.registerTenant({ tenantId: 'tenant-express-1', connectionString: 'file:./dev.db', status: 'ACTIVE' });
      const conn = router.getTenantConnection('tenant-express-1');
      expect(conn).toBeDefined();
    });
  });

  describe('CRDT LWW Resolver', () => {
    it('should resolve Last-Write-Wins based on higher timestamp', () => {
      const elem1 = { element: 'Stock-10', timestamp: 1000, nodeId: 'node-1' };
      const elem2 = { element: 'Stock-15', timestamp: 2000, nodeId: 'node-2' };
      const winner = CRDTStockResolver.mergeLWW(elem1, elem2);
      expect(winner.element).toBe('Stock-15');
    });

    it('should resolve tie-breaker using nodeId if timestamps are identical', () => {
      const elem1 = { element: 'Stock-A', timestamp: 1000, nodeId: 'node-1' };
      const elem2 = { element: 'Stock-B', timestamp: 1000, nodeId: 'node-2' };
      const winner = CRDTStockResolver.mergeLWW(elem1, elem2);
      expect(winner.element).toBe('Stock-B');
    });
  });

  describe('RFID Bulk Ingest Service', () => {
    it('should deduplicate repeated EPCs within window TTL', () => {
      const service = new RFIDBulkScanIngestionService();
      const batch = [
        { epc: 'EPC-101', sku: 'SKU-X', locationId: 'LOC-1', timestamp: new Date().toISOString() },
        { epc: 'EPC-101', sku: 'SKU-X', locationId: 'LOC-1', timestamp: new Date().toISOString() },
      ];
      const result = service.processBatch(batch);
      expect(result.processedCount).toBe(1);
      expect(result.duplicateCount).toBe(1);
    });
  });

  describe('AutonomousInventoryEngine', () => {
    it('should generate AUTO_REORDER tasks when stock drops below minimum threshold', () => {
      const engine = new AutonomousInventoryEngine();
      const inventory = [
        { sku: 'SKU-LOW', stock: 2, minStock: 10 },
        { sku: 'SKU-HEALTHY', stock: 50, minStock: 10 },
      ];
      const tasks = engine.runRebalanceRoutine(inventory);
      expect(tasks.length).toBe(1);
      expect(tasks[0].sku).toBe('SKU-LOW');
      expect(tasks[0].action).toBe('AUTO_REORDER');
    });
  });
});
