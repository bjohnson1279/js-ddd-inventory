import { Pool } from 'pg';
import { TenantRegistry } from './TenantRegistry';

/**
 * TenantProvisioner for JS/Express backend.
 * Provisions isolated PostgreSQL databases per tenant.
 */
export class TenantProvisioner {
  constructor(
    private readonly controlPrisma: any,
    private readonly registry: TenantRegistry
  ) {}

  async provisionTenant(tenantId: string): Promise<string> {
    const entry = await this.registry.registerTenant(tenantId);
    const dbName = entry.dbName;

    try {
      // Create the tenant's dedicated PostgreSQL database
      await this.createDatabase(dbName);

      // Connect to the new database and run DDL migrations
      await this.runMigrationsOnTenantDb(entry);

      // Seed default data
      await this.seedDefaultsOnTenantDb(entry, tenantId);

      await this.registry.updateStatus(tenantId, 'ACTIVE');
      await this.registry.updateMigratedVersion(tenantId, '1');

      console.log(`[TenantProvisioner] Tenant "${tenantId}" provisioned and ACTIVE (database: ${dbName}).`);
      return dbName;

    } catch (err: any) {
      console.error(`[TenantProvisioner] Failed to provision tenant "${tenantId}":`, err.message);
      try {
        await this.dropDatabase(dbName);
      } catch {}
      await this.registry.updateStatus(tenantId, 'DEPROVISIONED');
      throw err;
    }
  }

  async deprovisionTenant(tenantId: string): Promise<void> {
    const entry = await this.registry.lookupTenant(tenantId);
    if (!entry) throw new Error(`Tenant "${tenantId}" not found in registry.`);

    // Terminate active connections
    try {
      await this.controlPrisma.$executeRaw`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = ${entry.dbName}
          AND pid <> pg_backend_pid();
      `;
    } catch {}

    await this.dropDatabase(entry.dbName);
    await this.registry.deprovisionTenant(tenantId);
  }

  private async createDatabase(dbName: string): Promise<void> {
    const controlPool = this.getControlPool();
    const client = await controlPool.connect();
    try {
      const result = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
      if (result.rows.length === 0) {
        await client.query(`CREATE DATABASE "${dbName}"`);
      }
    } finally {
      client.release();
      await controlPool.end();
    }
  }

  private async dropDatabase(dbName: string): Promise<void> {
    const controlPool = this.getControlPool();
    const client = await controlPool.connect();
    try {
      await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    } finally {
      client.release();
      await controlPool.end();
    }
  }

  private getControlPool(): Pool {
    const connectionString = process.env.DATABASE_URL ||
      `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'password'}@${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'inventory'}`;
    return new Pool({ connectionString, max: 2 });
  }

  private getTenantPool(entry: { dbHost: string; dbPort: number; dbName: string; dbUser: string; dbPassword: string }): Pool {
    return new Pool({
      connectionString: `postgresql://${entry.dbUser}:${entry.dbPassword}@${entry.dbHost}:${entry.dbPort}/${entry.dbName}`,
      max: 2,
    });
  }

  private async runMigrationsOnTenantDb(entry: { dbHost: string; dbPort: number; dbName: string; dbUser: string; dbPassword: string }): Promise<void> {
    const tenantPool = this.getTenantPool(entry);
    const client = await tenantPool.connect();

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS inventory_items (
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
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS product_variants (
          id TEXT PRIMARY KEY,
          "productId" TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          sku TEXT NOT NULL UNIQUE,
          "trackingMode" TEXT NOT NULL DEFAULT 'quantity',
          "costingMethod" TEXT NOT NULL DEFAULT 'fifo',
          "weightGrams" INTEGER,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS ledger_entries (
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
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS journal_entries (
          id TEXT PRIMARY KEY,
          "tenantId" TEXT NOT NULL,
          date TIMESTAMPTZ NOT NULL,
          description TEXT NOT NULL,
          method TEXT NOT NULL,
          "referenceId" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS tenant_configs (
          "tenantId" TEXT PRIMARY KEY,
          "accountingMethod" TEXT NOT NULL DEFAULT 'accrual',
          "costingMethod" TEXT NOT NULL DEFAULT 'fifo'
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS warehouse_locations (
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
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS outbox_events (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          "eventType" TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          "lastError" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "processedAt" TIMESTAMPTZ,
          "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS rfid_tags (
          epc TEXT PRIMARY KEY,
          sku TEXT NOT NULL,
          serial_number TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          last_seen_at TIMESTAMPTZ,
          last_location TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

    } finally {
      client.release();
      await tenantPool.end();
    }
  }

  private async seedDefaultsOnTenantDb(
    entry: { dbHost: string; dbPort: number; dbName: string; dbUser: string; dbPassword: string },
    tenantId: string
  ): Promise<void> {
    const tenantPool = this.getTenantPool(entry);
    const client = await tenantPool.connect();
    try {
      await client.query(`
        INSERT INTO tenant_configs ("tenantId", "accountingMethod", "costingMethod")
        VALUES ($1, 'accrual', 'fifo')
        ON CONFLICT ("tenantId") DO NOTHING
      `, [tenantId]);
    } finally {
      client.release();
      await tenantPool.end();
    }
  }
}
