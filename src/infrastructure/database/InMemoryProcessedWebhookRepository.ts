import { IProcessedWebhookRepository } from "../../domain/repositories/IProcessedWebhookRepository";

export class InMemoryProcessedWebhookRepository implements IProcessedWebhookRepository {
  private readonly processedIds = new Set<string>();

  async exists(id: string): Promise<boolean> {
    return this.processedIds.has(id);
  }

  async save(id: string): Promise<void> {
    this.processedIds.add(id);
  }
}
