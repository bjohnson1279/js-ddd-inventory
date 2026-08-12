import { IProcessedWebhookRepository } from "../../domain/repositories/IProcessedWebhookRepository";

import { PrismaBaseRepository } from "./PrismaBaseRepository";

export class PrismaProcessedWebhookRepository extends PrismaBaseRepository implements IProcessedWebhookRepository {

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
