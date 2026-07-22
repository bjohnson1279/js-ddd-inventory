import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { TenantRegistry, TenantRegistryEntry } from './TenantRegistry';

interface PoolEntry {
  prisma: PrismaClient;
  pool: Pool;
  lastAccessedAt: number;
  tenantId: string;
  dbName: string;
}

/**
 * TenantConnectionPool for JS/Express backend.
 * LRU-cached pool of PrismaClient instances, one per tenant database.
 */
export class TenantConnectionPool {
  private cache = new Map<string, PoolEntry>();
  private evictionTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly registry: TenantRegistry,
    private readonly maxSize: number = 50,
    private readonly maxIdleMs: number = 5 * 60 * 1000,
    private readonly evictionIntervalMs: number = 60 * 1000
  ) {
    this.startEvictionLoop();
  }

  async getClient(tenantId: string): Promise<PrismaClient> {
    const existing = this.cache.get(tenantId);
    if (existing) {
      existing.lastAccessedAt = Date.now();
      return existing.prisma;
    }

    const entry = await this.registry.lookupTenant(tenantId);
    if (!entry) {
      throw new Error(`Tenant "${tenantId}" not found in registry.`);
    }
    if (entry.status !== 'ACTIVE') {
      throw new Error(`Tenant "${tenantId}" is not active (status: "${entry.status}").`);
    }

    if (this.cache.size >= this.maxSize) {
      await this.evictLRU();
    }

    const client = await this.createClient(entry);
    this.cache.set(tenantId, client);
    return client.prisma;
  }

  has(tenantId: string): boolean {
    return this.cache.has(tenantId);
  }

  async evict(tenantId: string): Promise<void> {
    const entry = this.cache.get(tenantId);
    if (entry) {
      await this.disconnectEntry(entry);
      this.cache.delete(tenantId);
    }
  }

  async warmPool(): Promise<number> {
    const activeTenants = await this.registry.listTenants('ACTIVE');
    let warmed = 0;
    for (const tenant of activeTenants) {
      if (!this.cache.has(tenant.tenantId) && this.cache.size < this.maxSize) {
        try {
          await this.getClient(tenant.tenantId);
          warmed++;
        } catch (err: any) {
          console.error(`[TenantConnectionPool] Failed to warm tenant "${tenant.tenantId}":`, err.message);
        }
      }
    }
    return warmed;
  }

  getStats(): { size: number; maxSize: number; tenantIds: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      tenantIds: Array.from(this.cache.keys()),
    };
  }

  async shutdown(): Promise<void> {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
    for (const [, entry] of this.cache.entries()) {
      await this.disconnectEntry(entry);
    }
    this.cache.clear();
  }

  private async createClient(entry: TenantRegistryEntry): Promise<PoolEntry> {
    // Connect to tenant's dedicated database on the default public schema
    const connectionString = `postgresql://${entry.dbUser}:${entry.dbPassword}@${entry.dbHost}:${entry.dbPort}/${entry.dbName}?schema=public&connection_limit=10`;

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter } as any);

    return {
      prisma,
      pool,
      lastAccessedAt: Date.now(),
      tenantId: entry.tenantId,
      dbName: entry.dbName,
    };
  }

  private async disconnectEntry(entry: PoolEntry): Promise<void> {
    try {
      await entry.prisma.$disconnect();
      await entry.pool.end();
    } catch (err: any) {
      console.error(`[TenantConnectionPool] Error disconnecting tenant "${entry.tenantId}":`, err.message);
    }
  }

  private async evictLRU(): Promise<void> {
    let oldest: PoolEntry | null = null;
    let oldestKey: string | null = null;
    for (const [key, entry] of this.cache.entries()) {
      if (!oldest || entry.lastAccessedAt < oldest.lastAccessedAt) {
        oldest = entry;
        oldestKey = key;
      }
    }
    if (oldestKey && oldest) {
      await this.disconnectEntry(oldest);
      this.cache.delete(oldestKey);
    }
  }

  private startEvictionLoop(): void {
    this.evictionTimer = setInterval(async () => {
      const now = Date.now();
      const toEvict: string[] = [];
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.lastAccessedAt > this.maxIdleMs) {
          toEvict.push(key);
        }
      }
      for (const key of toEvict) {
        await this.evict(key);
      }
    }, this.evictionIntervalMs);
  }
}
