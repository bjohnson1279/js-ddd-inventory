import { TenantRegistry } from './TenantRegistry';

/**
 * TenantProvisioner for JS/Express backend.
 * Provisions isolated PostgreSQL schemas per tenant.
 */
export class TenantProvisioner {
  constructor(
    private readonly controlPrisma: any,
    private readonly registry: TenantRegistry
  ) {}

  async provisionTenant(tenantId: string): Promise<string> {
    const entry = await this.registry.registerTenant(tenantId);
    const schemaName = entry.schemaName;

    try {
      await this.controlPrisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);

      await this.runMigrations(schemaName);
      await this.seedDefaults(schemaName, tenantId);

      await this.registry.updateStatus(tenantId, 'ACTIVE');
      await this.registry.updateMigratedVersion(tenantId, '1');

      console.log(`[TenantProvisioner] Tenant "${tenantId}" provisioned and ACTIVE.`);
      return schemaName;

    } catch (err: any) {
      console.error(`[TenantProvisioner] Failed to provision tenant "${tenantId}":`, err.message);
      try {
        await this.controlPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
      } catch {}
      await this.registry.updateStatus(tenantId, 'DEPROVISIONED');
      throw err;
    }
  }

  async deprovisionTenant(tenantId: string): Promise<void> {
    const entry = await this.registry.lookupTenant(tenantId);
    if (!entry) throw new Error(`Tenant "${tenantId}" not found in registry.`);

    await this.controlPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${entry.schemaName}" CASCADE;`);
    await this.registry.deprovisionTenant(tenantId);
  }

  private async runMigrations(schemaName: string): Promise<void> {
    await this.controlPrisma.$executeRawUnsafe(`SET search_path TO "${schemaName}";`);

    try {
      // Core tables matching the JS/Express Prisma schema
      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".inventory_items (
          id TEXT PRIMARY KEY,
          sku TEXT NOT NULL,
          "locationId" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          allocated INTEGER NOT NULL DEFAULT 0,
          "inTransit" INTEGER NOT NULL DEFAULT 0,
          "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
          version INTEGER NOT NULL,
          UNIQUE(sku, "locationId")
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".product_variants (
          id TEXT PRIMARY KEY,
          "productId" TEXT NOT NULL REFERENCES "${schemaName}".products(id) ON DELETE CASCADE,
          sku TEXT NOT NULL UNIQUE,
          "trackingMode" TEXT NOT NULL DEFAULT 'quantity',
          "costingMethod" TEXT NOT NULL DEFAULT 'fifo',
          "weightGrams" INTEGER,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".ledger_entries (
          id TEXT PRIMARY KEY,
          "tenantId" TEXT NOT NULL,
          "locationId" TEXT NOT NULL,
          "variantId" TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          reason TEXT NOT NULL,
          "actorId" TEXT NOT NULL,
          "occurredAt" TIMESTAMPTZ NOT NULL,
          "referenceId" TEXT,
          metadata JSONB,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".journal_entries (
          id TEXT PRIMARY KEY,
          "tenantId" TEXT NOT NULL,
          date TIMESTAMPTZ NOT NULL,
          description TEXT NOT NULL,
          method TEXT NOT NULL,
          "referenceId" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".tenant_configs (
          "tenantId" TEXT PRIMARY KEY,
          "accountingMethod" TEXT NOT NULL DEFAULT 'accrual',
          "costingMethod" TEXT NOT NULL DEFAULT 'fifo'
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".warehouse_locations (
          id TEXT PRIMARY KEY,
          "warehouseId" TEXT NOT NULL,
          zone TEXT NOT NULL,
          aisle TEXT NOT NULL,
          rack TEXT NOT NULL,
          shelf TEXT NOT NULL,
          bin TEXT NOT NULL,
          "maxWeightGrams" INTEGER NOT NULL,
          "maxVolumeCubicMeters" DOUBLE PRECISION NOT NULL,
          "gridX" INTEGER NOT NULL DEFAULT 0,
          "gridY" INTEGER NOT NULL DEFAULT 0,
          width INTEGER NOT NULL DEFAULT 1,
          height INTEGER NOT NULL DEFAULT 1,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

    } finally {
      await this.controlPrisma.$executeRawUnsafe(`SET search_path TO "public";`);
    }
  }

  private async seedDefaults(schemaName: string, tenantId: string): Promise<void> {
    await this.controlPrisma.$executeRawUnsafe(`
      INSERT INTO "${schemaName}".tenant_configs ("tenantId", "accountingMethod", "costingMethod")
      VALUES ('${tenantId}', 'accrual', 'fifo')
      ON CONFLICT ("tenantId") DO NOTHING;
    `);
  }
}
