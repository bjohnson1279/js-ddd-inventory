jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    processedWebhookModel: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { PrismaProcessedWebhookRepository } from "../../../src/infrastructure/database/PrismaProcessedWebhookRepository";
import { prisma as sharedPrisma } from "../../../src/infrastructure/database/prisma";

describe("PrismaProcessedWebhookRepository", () => {
  let repository: PrismaProcessedWebhookRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PrismaProcessedWebhookRepository();
  });

  describe("exists", () => {
    it("should return true when a webhook record is found", async () => {
      (sharedPrisma.processedWebhookModel.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "webhook-123",
        processedAt: new Date("2024-01-01T00:00:00.000Z"),
      });

      const result = await repository.exists("webhook-123");

      expect(sharedPrisma.processedWebhookModel.findUnique).toHaveBeenCalledTimes(1);
      expect(sharedPrisma.processedWebhookModel.findUnique).toHaveBeenCalledWith({
        where: { id: "webhook-123" },
      });
      expect(result).toBe(true);
    });

    it("should return false when no webhook record is found", async () => {
      (sharedPrisma.processedWebhookModel.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const result = await repository.exists("non-existent-webhook");

      expect(sharedPrisma.processedWebhookModel.findUnique).toHaveBeenCalledTimes(1);
      expect(sharedPrisma.processedWebhookModel.findUnique).toHaveBeenCalledWith({
        where: { id: "non-existent-webhook" },
      });
      expect(result).toBe(false);
    });

    it("should handle empty string as an ID", async () => {
      (sharedPrisma.processedWebhookModel.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "",
        processedAt: new Date(),
      });

      const result = await repository.exists("");

      expect(sharedPrisma.processedWebhookModel.findUnique).toHaveBeenCalledWith({
        where: { id: "" },
      });
      expect(result).toBe(true);
    });

    it("should propagate database errors when findUnique fails", async () => {
      const dbError = new Error("Database connection failed");
      (sharedPrisma.processedWebhookModel.findUnique as jest.Mock).mockRejectedValueOnce(dbError);

      await expect(repository.exists("webhook-err")).rejects.toThrow("Database connection failed");
      expect(sharedPrisma.processedWebhookModel.findUnique).toHaveBeenCalledWith({
        where: { id: "webhook-err" },
      });
    });
  });

  describe("save", () => {
    it("should create a processed webhook record with the specified ID", async () => {
      (sharedPrisma.processedWebhookModel.create as jest.Mock).mockResolvedValueOnce({
        id: "webhook-456",
        processedAt: new Date(),
      });

      await repository.save("webhook-456");

      expect(sharedPrisma.processedWebhookModel.create).toHaveBeenCalledTimes(1);
      expect(sharedPrisma.processedWebhookModel.create).toHaveBeenCalledWith({
        data: { id: "webhook-456" },
      });
    });

    it("should handle empty string as an ID when saving", async () => {
      (sharedPrisma.processedWebhookModel.create as jest.Mock).mockResolvedValueOnce({
        id: "",
        processedAt: new Date(),
      });

      await repository.save("");

      expect(sharedPrisma.processedWebhookModel.create).toHaveBeenCalledWith({
        data: { id: "" },
      });
    });

    it("should propagate database errors when create fails", async () => {
      const dbError = new Error("Unique constraint violation");
      (sharedPrisma.processedWebhookModel.create as jest.Mock).mockRejectedValueOnce(dbError);

      await expect(repository.save("webhook-dup")).rejects.toThrow("Unique constraint violation");
      expect(sharedPrisma.processedWebhookModel.create).toHaveBeenCalledWith({
        data: { id: "webhook-dup" },
      });
    });
  });
});
