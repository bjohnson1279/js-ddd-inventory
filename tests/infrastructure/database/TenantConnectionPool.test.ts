import { TenantConnectionPool } from '../../../src/infrastructure/database/TenantConnectionPool';
import { TenantRegistry } from '../../../src/infrastructure/database/TenantRegistry';

describe('TenantConnectionPool', () => {
  let mockRegistry: jest.Mocked<TenantRegistry>;
  let pool: TenantConnectionPool;

  beforeEach(() => {
    mockRegistry = {
      lookupTenant: jest.fn(),
      listTenants: jest.fn().mockResolvedValue([]),
      registerTenant: jest.fn(),
      updateStatus: jest.fn(),
      updateMigratedVersion: jest.fn(),
      deprovisionTenant: jest.fn(),
    } as any;

    pool = new TenantConnectionPool(mockRegistry, 3, 60000, 60000);
  });

  afterEach(async () => {
    await pool.shutdown();
  });

  describe('getClient', () => {
    it('should throw if tenant not found in registry', async () => {
      mockRegistry.lookupTenant.mockResolvedValue(null);

      await expect(pool.getClient('nonexistent'))
        .rejects.toThrow('not found in registry');
    });

    it('should throw if tenant is not ACTIVE', async () => {
      mockRegistry.lookupTenant.mockResolvedValue({
        tenantId: 'provisioning-tenant',
        dbHost: '127.0.0.1',
        dbPort: 5432,
        dbName: 'inventory_tenant_provisioning_tenant',
        dbUser: 'postgres',
        dbPassword: 'password',
        status: 'PROVISIONING',
        provisionedAt: new Date(),
        migratedVersion: '1',
      });

      await expect(pool.getClient('provisioning-tenant'))
        .rejects.toThrow('not active');
    });
  });

  describe('has', () => {
    it('should return false for uncached tenants', () => {
      expect(pool.has('uncached')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return empty stats initially', () => {
      const stats = pool.getStats();
      expect(stats.size).toBe(0);
      expect(stats.maxSize).toBe(3);
      expect(stats.tenantIds).toEqual([]);
    });
  });

  describe('warmPool', () => {
    it('should call listTenants with ACTIVE status', async () => {
      mockRegistry.listTenants.mockResolvedValue([]);

      const warmed = await pool.warmPool();

      expect(warmed).toBe(0);
      expect(mockRegistry.listTenants).toHaveBeenCalledWith('ACTIVE');
    });

    it('should warm eligible uncached active tenants concurrently up to maxSize', async () => {
      const activeTenants = Array.from({ length: 5 }, (_, i) => ({
        tenantId: `tenant-${i}`,
        dbHost: '127.0.0.1',
        dbPort: 5432,
        dbName: `inventory_tenant_${i}`,
        dbUser: 'postgres',
        dbPassword: 'password',
        status: 'ACTIVE' as const,
        provisionedAt: new Date(),
        migratedVersion: '1',
      }));

      mockRegistry.listTenants.mockResolvedValue(activeTenants);
      mockRegistry.lookupTenant.mockImplementation(async (tenantId: string) => {
        // simulate async lookup latency
        await new Promise((resolve) => setTimeout(resolve, 100));
        return activeTenants.find((t) => t.tenantId === tenantId) || null;
      });

      const start = Date.now();
      const warmed = await pool.warmPool();
      const duration = Date.now() - start;

      // pool maxSize is 3, so only 3 tenants should be warmed
      expect(warmed).toBe(3);
      // Serial execution for 3 items with 100ms delay each would take >= 300ms.
      // Parallel execution should take roughly ~100-150ms.
      expect(duration).toBeLessThan(250);
    });

    it('should handle errors gracefully when warming individual tenants', async () => {
      const activeTenants = [
        {
          tenantId: 'valid-tenant-1',
          dbHost: '127.0.0.1',
          dbPort: 5432,
          dbName: 'inventory_tenant_1',
          dbUser: 'postgres',
          dbPassword: 'password',
          status: 'ACTIVE' as const,
          provisionedAt: new Date(),
          migratedVersion: '1',
        },
        {
          tenantId: 'failing-tenant-2',
          dbHost: '127.0.0.1',
          dbPort: 5432,
          dbName: 'inventory_tenant_2',
          dbUser: 'postgres',
          dbPassword: 'password',
          status: 'ACTIVE' as const,
          provisionedAt: new Date(),
          migratedVersion: '1',
        },
      ];

      mockRegistry.listTenants.mockResolvedValue(activeTenants);
      mockRegistry.lookupTenant.mockImplementation(async (tenantId: string) => {
        if (tenantId === 'failing-tenant-2') {
          throw new Error('Database connection failed');
        }
        return activeTenants.find((t) => t.tenantId === tenantId) || null;
      });

      const warmed = await pool.warmPool();
      expect(warmed).toBe(1);
    });
  });

  describe('evict', () => {
    it('should be a no-op for uncached tenants', async () => {
      await pool.evict('nonexistent');
      expect(pool.has('nonexistent')).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('should clear all connections', async () => {
      await pool.shutdown();
      const stats = pool.getStats();
      expect(stats.size).toBe(0);
    });
  });
});
