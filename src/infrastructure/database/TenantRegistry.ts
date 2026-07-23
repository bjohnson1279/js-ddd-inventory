/**
 * TenantRegistryEntry represents a tenant's isolated database metadata.
 */
export interface TenantRegistryEntry {
  tenantId: string;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  status: 'PROVISIONING' | 'ACTIVE' | 'MIGRATING' | 'DEPROVISIONED';
  provisionedAt: Date;
  migratedVersion: string;
}

/**
 * TenantRegistry manages tenant-to-database mappings in the JS/Express backend.
 * Each tenant gets its own PostgreSQL database.
 */
export class TenantRegistry {
  constructor(private readonly controlPrisma: any) {}

  async registerTenant(
    tenantId: string,
    dbHost?: string,
    dbPort?: number,
    dbName?: string,
    dbUser?: string,
    dbPassword?: string
  ): Promise<TenantRegistryEntry> {
    const safeName = tenantId.replace(/[^a-zA-Z0-9_]/g, '_');
    const host = dbHost || process.env.DB_HOST || '127.0.0.1';
    const port = dbPort || parseInt(process.env.DB_PORT || '5432', 10);
    const name = dbName || `inventory_tenant_${safeName}`;
    const user = dbUser || process.env.DB_USER || 'postgres';
    const password = dbPassword || process.env.DB_PASSWORD || 'password';

    const existing = await this.lookupTenant(tenantId);
    if (existing && existing.status !== 'DEPROVISIONED') {
      throw new Error(`Tenant "${tenantId}" is already registered with status "${existing.status}".`);
    }

    const entry: TenantRegistryEntry = {
      tenantId,
      dbHost: host,
      dbPort: port,
      dbName: name,
      dbUser: user,
      dbPassword: password,
      status: 'PROVISIONING',
      provisionedAt: new Date(),
      migratedVersion: '0',
    };

    await this.controlPrisma.$executeRaw`
      INSERT INTO tenant_registry (tenant_id, db_host, db_port, db_name, db_user, db_password, status, provisioned_at, migrated_version)
      VALUES (${tenantId}, ${entry.dbHost}, ${entry.dbPort}, ${entry.dbName}, ${entry.dbUser}, ${entry.dbPassword}, ${entry.status}, NOW(), ${entry.migratedVersion})
      ON CONFLICT (tenant_id) DO UPDATE SET
        db_host = EXCLUDED.db_host,
        db_port = EXCLUDED.db_port,
        db_name = EXCLUDED.db_name,
        db_user = EXCLUDED.db_user,
        db_password = EXCLUDED.db_password,
        status = EXCLUDED.status,
        provisioned_at = NOW(),
        migrated_version = EXCLUDED.migrated_version;
    `;

    return entry;
  }

  async lookupTenant(tenantId: string): Promise<TenantRegistryEntry | null> {
    const results: any[] = await this.controlPrisma.$queryRaw`
      SELECT tenant_id, db_host, db_port, db_name, db_user, db_password, status, provisioned_at, migrated_version
      FROM tenant_registry
      WHERE tenant_id = ${tenantId};
    `;

    if (results.length === 0) return null;

    const row = results[0];
    return {
      tenantId: row.tenant_id,
      dbHost: row.db_host,
      dbPort: row.db_port,
      dbName: row.db_name,
      dbUser: row.db_user,
      dbPassword: row.db_password,
      status: row.status,
      provisionedAt: new Date(row.provisioned_at),
      migratedVersion: row.migrated_version,
    };
  }

  async listTenants(status?: string): Promise<TenantRegistryEntry[]> {
    const results: any[] = status
      ? await this.controlPrisma.$queryRaw`
          SELECT tenant_id, db_host, db_port, db_name, db_user, db_password, status, provisioned_at, migrated_version
          FROM tenant_registry
          WHERE status = ${status}
          ORDER BY provisioned_at DESC;
        `
      : await this.controlPrisma.$queryRaw`
          SELECT tenant_id, db_host, db_port, db_name, db_user, db_password, status, provisioned_at, migrated_version
          FROM tenant_registry
          ORDER BY provisioned_at DESC;
        `;

    return results.map((row: any) => ({
      tenantId: row.tenant_id,
      dbHost: row.db_host,
      dbPort: row.db_port,
      dbName: row.db_name,
      dbUser: row.db_user,
      dbPassword: row.db_password,
      status: row.status,
      provisionedAt: new Date(row.provisioned_at),
      migratedVersion: row.migrated_version,
    }));
  }

  async updateStatus(tenantId: string, status: TenantRegistryEntry['status']): Promise<void> {
    await this.controlPrisma.$executeRaw`
      UPDATE tenant_registry SET status = ${status} WHERE tenant_id = ${tenantId};
    `;
  }

  async updateMigratedVersion(tenantId: string, version: string): Promise<void> {
    await this.controlPrisma.$executeRaw`
      UPDATE tenant_registry SET migrated_version = ${version} WHERE tenant_id = ${tenantId};
    `;
  }

  async deprovisionTenant(tenantId: string): Promise<void> {
    await this.updateStatus(tenantId, 'DEPROVISIONED');
  }
}
