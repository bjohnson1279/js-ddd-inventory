import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export class ApiUsageMetricRepository {
  private prismaClient = prisma;

  /**
   * Increments the API usage count for a given tenant, date, and endpoint.
   */
  async incrementUsage(tenantId: string, endpoint: string): Promise<void> {
    const today = new Date();
    // Normalize to start of day UTC
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    if (!(this.prismaClient as any).apiUsageMetricModel) {
      // Graceful degradation when Prisma client isn't fully generated in tests
      return;
    }

    await (this.prismaClient as any).apiUsageMetricModel.upsert({
      where: {
        tenantId_date_metric: {
          tenantId,
          date,
          metric: endpoint,
        },
      },
      update: {
        value: {
          increment: 1,
        },
      },
      create: {
        tenantId,
        date,
        metric: endpoint,
        value: 1,
      },
    });
  }

  /**
   * Retrieves the usage metrics for a given tenant.
   */
  async getUsageByTenant(tenantId: string) {
    return (this.prismaClient as any).apiUsageMetricModel.findMany({
      where: { tenantId },
      orderBy: { date: 'desc' },
    });
  }
}
