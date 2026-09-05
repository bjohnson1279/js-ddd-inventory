import { InMemoryProcessedWebhookRepository } from "../../../src/infrastructure/database/InMemoryProcessedWebhookRepository";

describe("InMemoryProcessedWebhookRepository", () => {
  let repository: InMemoryProcessedWebhookRepository;

  beforeEach(() => {
    repository = new InMemoryProcessedWebhookRepository();
  });

  it("should return false for an ID that has not been processed", async () => {
    const exists = await repository.exists("webhook-123");
    expect(exists).toBe(false);
  });

  it("should return true for an ID that has been saved", async () => {
    await repository.save("webhook-123");
    const exists = await repository.exists("webhook-123");
    expect(exists).toBe(true);
  });

  it("should handle multiple IDs correctly", async () => {
    await repository.save("webhook-1");
    await repository.save("webhook-2");

    expect(await repository.exists("webhook-1")).toBe(true);
    expect(await repository.exists("webhook-2")).toBe(true);
    expect(await repository.exists("webhook-3")).toBe(false);
  });

  it("should handle saving the same ID multiple times without throwing errors", async () => {
    await repository.save("webhook-123");
    await repository.save("webhook-123");

    const exists = await repository.exists("webhook-123");
    expect(exists).toBe(true);
  });
});
