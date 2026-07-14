import { WebhookDeliveryWorker } from "../../../src/infrastructure/workers/WebhookDeliveryWorker";
import { prisma } from "../../../src/infrastructure/database/prisma";
import crypto from "crypto";

jest.mock("../../../src/infrastructure/database/prisma", () => {
  return {
    prisma: {
      webhookDeliveryModel: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn()
      },
      webhookSubscriptionModel: {
        findUnique: jest.fn(),
        findMany: jest.fn()
      }
    }
  };
});

describe("WebhookDeliveryWorker (Express)", () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("should process pending deliveries successfully", async () => {
    const mockDelivery = {
      id: "delivery-1",
      subscriptionId: "sub-1",
      eventType: "StockUpdated",
      payload: JSON.stringify({ sku: "SKU-A", quantity: 10 }),
      attempts: 0
    };

    const mockSubscription = {
      id: "sub-1",
      isActive: true,
      targetUrl: "https://example.com/express-webhook",
      secret: "express-secret"
    };

    (prisma.webhookDeliveryModel.findMany as jest.Mock).mockResolvedValue([mockDelivery]);
    (prisma.webhookSubscriptionModel.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200
    } as any);

    await WebhookDeliveryWorker.processPendingDeliveries();

    expect(prisma.webhookDeliveryModel.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["delivery-1"] } },
      data: { status: "Processing" }
    });

    const expectedSignature = crypto
      .createHmac("sha256", "express-secret")
      .update(mockDelivery.payload)
      .digest("hex");

    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/express-webhook", {
      redirect: "error",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature-256": expectedSignature,
        "X-Webhook-Event": "StockUpdated"
      },
      body: mockDelivery.payload
    });

    expect(prisma.webhookDeliveryModel.update).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      data: expect.objectContaining({
        status: "Success",
        attempts: 1,
        processedAt: expect.any(Date)
      })
    });
  });

  it("should handle HTTP error status and retry", async () => {
    const mockDelivery = {
      id: "delivery-2",
      subscriptionId: "sub-2",
      eventType: "StockUpdated",
      payload: JSON.stringify({ sku: "SKU-B", quantity: 0 }),
      attempts: 1
    };

    const mockSubscription = {
      id: "sub-2",
      isActive: true,
      targetUrl: "https://example.com/express-webhook-fail",
      secret: "express-secret-2"
    };

    (prisma.webhookDeliveryModel.findMany as jest.Mock).mockResolvedValue([mockDelivery]);
    (prisma.webhookSubscriptionModel.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 404
    } as any);

    await WebhookDeliveryWorker.processPendingDeliveries();

    expect(prisma.webhookDeliveryModel.update).toHaveBeenCalledWith({
      where: { id: "delivery-2" },
      data: expect.objectContaining({
        status: "Pending",
        attempts: 2,
        lastError: "HTTP Error Status: 404",
        nextAttemptAt: expect.any(Date)
      })
    });
  });
});
