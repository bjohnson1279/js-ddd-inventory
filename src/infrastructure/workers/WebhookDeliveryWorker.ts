import { prisma } from "../database/prisma";
import crypto from "crypto";
import dns from "dns/promises";
import { WebSocketManager } from "../websocket/WebSocketManager";

async function isSafeUrl(urlStr: string): Promise<boolean> {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;

    const { address } = await dns.lookup(url.hostname);

    if (address === "127.0.0.1" || address === "::1" || address === "0.0.0.0")
      return false;

    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = address.match(ipv4Regex);
    if (match) {
      const p1 = parseInt(match[1], 10);
      const p2 = parseInt(match[2], 10);

      if (p1 === 10) return false;
      if (p1 === 172 && p2 >= 16 && p2 <= 31) return false;
      if (p1 === 192 && p2 === 168) return false;
      if (p1 === 169 && p2 === 254) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export class WebhookDeliveryWorker {
  private static isRunning = false;
  private static timer: NodeJS.Timeout | null = null;

  public static start(intervalMs = 2000) {
    if (this.timer) return;
    this.timer = setInterval(() => this.processPendingDeliveries(), intervalMs);
    console.log(
      `[WebhookDeliveryWorker] Started background worker (polling every ${intervalMs}ms)`,
    );
  }

  public static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log("[WebhookDeliveryWorker] Stopped background worker");
  }

  public static async processPendingDeliveries() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const deliveries = await prisma.webhookDeliveryModel.findMany({
        where: {
          status: "Pending",
          nextAttemptAt: {
            lte: new Date(),
          },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      });

      if (deliveries.length === 0) return;

      const deliveryIds = deliveries.map((d: any) => d.id);
      await prisma.webhookDeliveryModel.updateMany({
        where: { id: { in: deliveryIds } },
        data: { status: "Processing" },
      });

      // Extract unique subscription IDs and bulk fetch them
      const uniqueSubscriptionIds = Array.from(
        new Set(deliveries.map((d: any) => d.subscriptionId)),
      );
      const subscriptions = await prisma.webhookSubscriptionModel.findMany({
        where: { id: { in: uniqueSubscriptionIds } },
      });

      const subscriptionMap = new Map(subscriptions.map((s: any) => [s.id, s]));

      for (const delivery of deliveries) {
        try {
          const subscription = subscriptionMap.get(delivery.subscriptionId);

          if (!subscription || !subscription.isActive) {
            throw new Error(
              `Subscription ${delivery.subscriptionId} not found or inactive`,
            );
          }

          // Calculate signature
          const hmac = crypto.createHmac("sha256", subscription.secret);
          const signature = hmac.update(delivery.payload).digest("hex");

          // Verify target URL is safe to prevent SSRF
          if (!(await isSafeUrl(subscription.targetUrl))) {
            throw new Error("Unsafe webhook target URL blocked");
          }

          // Send POST request
          const response = await fetch(subscription.targetUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Webhook-Signature-256": signature,
              "X-Webhook-Event": delivery.eventType,
            },
            body: delivery.payload,
          });

          if (!response.ok) {
            throw new Error(`HTTP Error Status: ${response.status}`);
          }

          // Mark as Success
          await prisma.webhookDeliveryModel.update({
            where: { id: delivery.id },
            data: {
              status: "Success",
              attempts: delivery.attempts + 1,
              processedAt: new Date(),
            },
          });
          console.log(
            `[WebhookDeliveryWorker] Successfully delivered webhook ${delivery.id} to ${subscription.targetUrl}`,
          );
        } catch (err: any) {
          const nextAttempts = delivery.attempts + 1;
          const backoffMs = Math.min(
            Math.pow(2, nextAttempts) * 1000,
            24 * 60 * 60 * 1000,
          );
          const nextAttemptAt = new Date(Date.now() + backoffMs);
          const nextStatus = nextAttempts >= 5 ? "Failed" : "Pending";

          console.error(
            `[WebhookDeliveryWorker] Failed to deliver webhook ${delivery.id}:`,
            err.message,
          );

          await prisma.webhookDeliveryModel.update({
            where: { id: delivery.id },
            data: {
              status: nextStatus,
              attempts: nextAttempts,
              lastError: err.message,
              nextAttemptAt,
            },
          });

          // Broadcast webhook failure
          const tenantId = delivery.tenantId || "tenant-1";
          WebSocketManager.broadcastToTenant(tenantId, {
            type: "webhook_failed",
            id: delivery.id,
            subscriptionId: delivery.subscriptionId,
            eventType: delivery.eventType,
            attempts: nextAttempts,
            status: nextStatus,
            lastError: err.message,
          });
        }
      }
    } catch (error) {
      console.error(
        "[WebhookDeliveryWorker] Error in background worker loop:",
        error,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
