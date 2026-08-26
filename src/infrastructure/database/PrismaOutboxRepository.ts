import { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";
import { IDomainEvent } from "../../domain/events/IDomainEvent";
import { prisma } from "./prisma";
import { getTraceId } from "../telemetry/traceContext";

export class PrismaOutboxRepository implements IOutboxRepository {
  private prisma = prisma;

  async save(event: IDomainEvent, tx?: any): Promise<void> {
    const client = tx || this.prisma;
    
    // Serialize all fields of the event including traceId
    const payload = JSON.stringify({
      ...event,
      traceId: (event as any).traceId || getTraceId(),
      occurredOn: event.occurredOn.toISOString()
    });

    await client.outboxEventModel.create({
      data: {
        eventName: event.eventName,
        payload,
        occurredOn: event.occurredOn
      }
    });
  }

  async fetchPending(limit: number, maxAttempts: number = 5): Promise<any[]> {
    return this.prisma.outboxEventModel.findMany({
      where: {
        processedAt: null,
        attempts: {
          lt: maxAttempts
        },
        nextAttemptAt: {
          lte: new Date()
        }
      },
      orderBy: { occurredOn: "asc" },
      take: limit
    });
  }

  async markProcessed(id: string): Promise<void> {
    await this.prisma.outboxEventModel.update({
      where: { id },
      data: { processedAt: new Date() }
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    const record = await this.prisma.outboxEventModel.findUnique({
      where: { id }
    });
    if (!record) return;

    const nextAttempts = record.attempts + 1;
    const backoffMs = Math.min(Math.pow(2, nextAttempts) * 1000, 24 * 60 * 60 * 1000);
    const nextAttemptAt = new Date(Date.now() + backoffMs);

    await this.prisma.outboxEventModel.update({
      where: { id },
      data: {
        attempts: nextAttempts,
        lastError: error,
        nextAttemptAt
      }
    });
  }

  async fetchDeadLettered(limit: number, maxAttempts: number = 5): Promise<any[]> {
    return this.prisma.outboxEventModel.findMany({
      where: {
        processedAt: null,
        attempts: {
          gte: maxAttempts
        }
      },
      orderBy: { occurredOn: "desc" },
      take: limit
    });
  }

  async retryEvent(id: string): Promise<void> {
    await this.prisma.outboxEventModel.update({
      where: { id },
      data: {
        attempts: 0,
        lastError: null,
        nextAttemptAt: new Date()
      }
    });
  }

  async fetchStats(maxAttempts: number = 5): Promise<any> {
    const [pendingCount, processedCount, deadLetteredCount, recentFailures] = await Promise.all([
      this.prisma.outboxEventModel.count({
        where: {
          processedAt: null,
          attempts: { lt: maxAttempts }
        }
      }),
      this.prisma.outboxEventModel.count({
        where: {
          processedAt: { not: null }
        }
      }),
      this.prisma.outboxEventModel.count({
        where: {
          processedAt: null,
          attempts: { gte: maxAttempts }
        }
      }),
      this.prisma.outboxEventModel.findMany({
        where: {
          processedAt: null,
          attempts: {
            gt: 0,
            lt: maxAttempts
          }
        },
        orderBy: { occurredOn: "desc" },
        take: 10
      })
    ]);

    return {
      totalPending: pendingCount,
      totalProcessed: processedCount,
      totalDeadLettered: deadLetteredCount,
      recentFailures
    };
  }
}
