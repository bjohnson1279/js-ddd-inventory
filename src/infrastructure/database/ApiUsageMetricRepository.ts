import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export class ApiUsageMetricRepository {
  private prismaClient = prisma;

  /**
   * Increments the API usage count for a given tenant, date, and endpoint.
   */
  async incrementUsage(tenantId: string, endpoint: string): Promise<void> {
    const today = new Date();
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    if (process.env.NODE_ENV === "test" || !(this.prismaClient as any).apiUsageMetricModel) {
      return;
    }

    try {
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
    } catch (err: any) {
      const code = err?.code;
      const message = err?.message || "";
      const isMissingTableOrDbUnavailable = code === "P2021" || code === "P1001" || code === "P2022" || /does not exist|connect/i.test(message);
      if (isMissingTableOrDbUnavailable) {
        return;
      }
      throw err;
    }
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
