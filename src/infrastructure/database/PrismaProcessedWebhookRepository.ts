import { IProcessedWebhookRepository } from "../../domain/repositories/IProcessedWebhookRepository";
import { prisma } from "./prisma";

export class PrismaProcessedWebhookRepository implements IProcessedWebhookRepository {
  private prisma = prisma;

  async exists(id: string): Promise<boolean> {
    const record = await this.prisma.processedWebhookModel.findUnique({
      where: { id }
    });
    return record !== null;
  }

  async save(id: string): Promise<void> {
    await this.prisma.processedWebhookModel.create({
      data: { id }
    });
  }
}
