import { WebhookDeliveryWorker } from "../../../src/infrastructure/workers/WebhookDeliveryWorker";
import { prisma } from "../../../src/infrastructure/database/prisma";
import dns from "dns/promises";

jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    webhookDeliveryModel: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    webhookSubscriptionModel: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("dns/promises", () => ({
  lookup: jest.fn(),
}));

describe("WebhookDeliveryWorker SSRF Protection", () => {
  const mockFetch = jest.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.webhookDeliveryModel.findMany as jest.Mock).mockResolvedValue([
      { id: "del-1", subscriptionId: "sub-1", payload: "{}", eventType: "OrderCreated", attempts: 0 },
    ]);
    (prisma.webhookDeliveryModel.updateMany as jest.Mock).mockResolvedValue({});
    (prisma.webhookDeliveryModel.update as jest.Mock).mockResolvedValue({});
  });

  it("should prevent SSRF to localhost", async () => {
    (prisma.webhookSubscriptionModel.findUnique as jest.Mock).mockResolvedValue({
      id: "sub-1",
      isActive: true,
      targetUrl: "http://localhost:8080/hook",
      secret: "test",
    });

    (dns.lookup as jest.Mock).mockResolvedValue({ address: "127.0.0.1" });

    await WebhookDeliveryWorker.processPendingDeliveries();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(prisma.webhookDeliveryModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastError: expect.stringContaining("SSRF detected"),
        }),
      })
    );
  });

  it("should prevent SSRF to DNS rebinding targets (nip.io)", async () => {
    (prisma.webhookSubscriptionModel.findUnique as jest.Mock).mockResolvedValue({
      id: "sub-1",
      isActive: true,
      targetUrl: "http://169.254.169.254.nip.io/latest/meta-data/",
      secret: "test",
    });

    (dns.lookup as jest.Mock).mockResolvedValue({ address: "169.254.169.254" });

    await WebhookDeliveryWorker.processPendingDeliveries();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(prisma.webhookDeliveryModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastError: expect.stringContaining("SSRF detected"),
        }),
      })
    );
  });

  it("should allow safe external URLs", async () => {
    (prisma.webhookSubscriptionModel.findUnique as jest.Mock).mockResolvedValue({
      id: "sub-1",
      isActive: true,
      targetUrl: "https://example.com/hook",
      secret: "test",
    });

    (dns.lookup as jest.Mock).mockResolvedValue({ address: "93.184.216.34" });
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await WebhookDeliveryWorker.processPendingDeliveries();

    expect(mockFetch).toHaveBeenCalled();
    expect(mockFetch.mock.calls[0][1]).toHaveProperty("redirect", "error");
    expect(prisma.webhookDeliveryModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "Success",
        }),
      })
    );
  });
});
