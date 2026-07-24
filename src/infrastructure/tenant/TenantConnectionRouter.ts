import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

export interface TenantConnectionInfo {
  tenantId: string;
  connectionString: string;
  status: 'ACTIVE' | 'PROVISIONING' | 'MAINTENANCE';
}

export class TenantConnectionRouter {
  private static instance: TenantConnectionRouter;
  private prismaInstances: Map<string, PrismaClient> = new Map();
  private connectionRegistry: Map<string, TenantConnectionInfo> = new Map();

  private constructor() {}

  public static getInstance(): TenantConnectionRouter {
    if (!TenantConnectionRouter.instance) {
      TenantConnectionRouter.instance = new TenantConnectionRouter();
    }
    return TenantConnectionRouter.instance;
  }

  public registerTenant(info: TenantConnectionInfo): void {
    this.connectionRegistry.set(info.tenantId, info);
  }

  public getTenantConnection(tenantId: string): PrismaClient {
    if (this.prismaInstances.has(tenantId)) {
      return this.prismaInstances.get(tenantId)!;
    }

    const info = this.connectionRegistry.get(tenantId);
    const dbUrl = info ? info.connectionString : process.env.DATABASE_URL || 'postgresql://localhost:5432/postgres';

    const pool = new Pool({ connectionString: dbUrl });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter } as any);

    this.prismaInstances.set(tenantId, prisma);
    return prisma;
  }

  public async closeTenantConnection(tenantId: string): Promise<void> {
    const prisma = this.prismaInstances.get(tenantId);
    if (prisma) {
      await prisma.$disconnect();
      this.prismaInstances.delete(tenantId);
    }
  }

  public async closeAll(): Promise<void> {
    for (const [, prisma] of this.prismaInstances.entries()) {
      await prisma.$disconnect();
    }
    this.prismaInstances.clear();
  }
}
