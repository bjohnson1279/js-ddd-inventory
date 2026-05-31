export interface IProcessedWebhookRepository {
  exists(id: string): Promise<boolean>;
  save(id: string): Promise<void>;
}
