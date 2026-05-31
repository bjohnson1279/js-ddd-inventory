import { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";
import { IDomainEvent } from "../../domain/events/IDomainEvent";
import { prisma } from "./prisma";

export class PrismaOutboxRepository implements IOutboxRepository {
  private prisma = prisma;

  async save(event: IDomainEvent, tx?: any): Promise<void> {
    const client = tx || this.prisma;
    
    // Serialize all fields of the event
    const payload = JSON.stringify({
      ...event,
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

  async fetchPending(limit: number): Promise<any[]> {
    return this.prisma.outboxEventModel.findMany({
      where: { processedAt: null },
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
    await this.prisma.outboxEventModel.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        lastError: error
      }
    });
  }
}
