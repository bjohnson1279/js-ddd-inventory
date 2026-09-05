import { prisma } from "../database/prisma";
import crypto from "crypto";
import dns from "dns/promises";
import net from "net";
import { WebSocketManager } from "../websocket/WebSocketManager";
import { Logger } from "../../infrastructure/logging/logger";
import { decrypt } from "../utils/encryption";


async function isSafeUrl(urlStr: string): Promise<boolean> {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;

    const { address } = await dns.lookup(url.hostname);

    if (net.isIPv4(address)) {
      const parts = address.split('.');
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);

      if (p1 === 127) return false;
      if (p1 === 0) return false;
      if (p1 === 10) return false;
      if (p1 === 172 && p2 >= 16 && p2 <= 31) return false;
      if (p1 === 192 && p2 === 168) return false;
      if (p1 === 169 && p2 === 254) return false;
    } else if (net.isIPv6(address)) {
      // Normalize IPv6 address string
      const lower = address.toLowerCase();

      // Block all unspecified or loopback variations including compressed or long forms
      if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return false;
      if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return false;

      // Check if it's an IPv4-mapped address and extract the IPv4 portion
      let v4Part = null;
      if (lower.startsWith("::ffff:")) {
        v4Part = lower.substring(7);
      } else if (lower.startsWith("0:0:0:0:0:ffff:")) {
        v4Part = lower.substring(15);
      }

      if (v4Part) {
        // IPv4 mapped addresses can be standard ipv4 or hex encoded in the last 32 bits
        // e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1 (hex format)
        if (net.isIPv4(v4Part)) {
          const parts = v4Part.split('.');
          const p1 = parseInt(parts[0], 10);
          const p2 = parseInt(parts[1], 10);

          if (p1 === 127) return false;
          if (p1 === 0) return false;
          if (p1 === 10) return false;
          if (p1 === 172 && p2 >= 16 && p2 <= 31) return false;
          if (p1 === 192 && p2 === 168) return false;
          if (p1 === 169 && p2 === 254) return false;
        } else {
            // Hex format (e.g. 7f00:1 == 127.0.0.1)
            const parts = v4Part.split(':');
            if (parts.length > 0) {
               const hexP1P2 = parts[0];
               if (hexP1P2) {
                   const blockInt = parseInt(hexP1P2, 16);
                   if (!isNaN(blockInt)) {
                       const p1 = (blockInt >> 8) & 0xff;
                       const p2 = blockInt & 0xff;
                       if (p1 === 127) return false;
                       if (p1 === 0) return false;
                       if (p1 === 10) return false;
                       if (p1 === 172 && p2 >= 16 && p2 <= 31) return false;
                       if (p1 === 192 && p2 === 168) return false;
                       if (p1 === 169 && p2 === 254) return false;
                   }
               }
            }
        }
      }

      // Check for Unique Local Addresses (fc00::/7) and Link Local (fe80::/10)
      const firstBlock = lower.split(':')[0];
      if (firstBlock) {
        const blockInt = parseInt(firstBlock, 16);
        if (!isNaN(blockInt)) {
          if ((blockInt & 0xfe00) === 0xfc00) return false;
          if ((blockInt & 0xffc0) === 0xfe80) return false;
        }
      }
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
    Logger.info({ context: "WebhookDeliveryWorker", message: `[WebhookDeliveryWorker] Started background worker (polling every ${intervalMs}ms)` });
  }

  public static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    Logger.info({ context: "WebhookDeliveryWorker", message: "Stopped background worker" });
  }

  public static async processPendingDeliveries() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const deliveries = await prisma.webhookDeliveryModel.findMany({
        where: {
          status: "Pending",
          nextAttemptAt: {
            lte: new Date()
          }
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

      for (const delivery of deliveries) {
        try {
          const subscription = await prisma.webhookSubscriptionModel.findUnique({
            where: { id: delivery.subscriptionId }
          });

          if (!subscription || !subscription.isActive) {
            throw new Error(`Subscription ${delivery.subscriptionId} not found or inactive`);
          }

          // Calculate signature
          const decryptedSecret = decrypt(subscription.secret);
          const hmac = crypto.createHmac("sha256", decryptedSecret);
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
              "X-Webhook-Event": delivery.eventType
            },
            body: delivery.payload
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
              processedAt: new Date()
            }
          });
          Logger.info({ context: "WebhookDeliveryWorker", message: `[WebhookDeliveryWorker] Successfully delivered webhook ${delivery.id} to ${subscription.targetUrl}` });
        } catch (err: any) {
          const nextAttempts = delivery.attempts + 1;
          const backoffMs = Math.min(Math.pow(2, nextAttempts) * 1000, 24 * 60 * 60 * 1000);
          const nextAttemptAt = new Date(Date.now() + backoffMs);
          const nextStatus = nextAttempts >= 5 ? "Failed" : "Pending";

          Logger.error({ context: "WebhookDeliveryWorker", message: `[WebhookDeliveryWorker] Failed to deliver webhook ${delivery.id}:`, error: err.message });

          await prisma.webhookDeliveryModel.update({
            where: { id: delivery.id },
            data: {
              status: nextStatus,
              attempts: nextAttempts,
              lastError: err.message,
              nextAttemptAt
            }
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
            lastError: err.message
          });
        }
      }
    } catch (error) {
      Logger.error({ context: "WebhookDeliveryWorker", message: "Error in background worker loop:", error: error });
    } finally {
      this.isRunning = false;
    }
  }
}
