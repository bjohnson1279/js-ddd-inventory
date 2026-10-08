import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { DispatchStock } from "../../../application/useCases/DispatchStock";
import { ShopifyWebhookSecurity } from "../../shopify/ShopifyWebhookSecurity";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { IProcessedWebhookRepository } from "../../../domain/repositories/IProcessedWebhookRepository";
import { DomainException } from "../../../domain/exceptions/DomainException";
import { Logger } from "../../../infrastructure/logging/logger";


export class ShopifyWebhookController {
  constructor(private readonly security: ShopifyWebhookSecurity) {}

  public async handleOrderCreated(request: any, reply: any): Promise<void> {
    const repository = ((request.server as any)["inventoryRepository"] || (request.server as any)["repository"]) as IInventoryRepository;
    const processedWebhookRepo = (request.server as any).processedWebhookRepository as IProcessedWebhookRepository;
    const reorderPolicyService = (request.server as any)["reorderPolicyService"];
    const dispatchRecordRepository = (request.server as any)["dispatchRecordRepository"];
    const dispatchStock = new DispatchStock(repository, undefined, reorderPolicyService, dispatchRecordRepository);

    const getHeader = (name: string) => {
      if (typeof request.headers?.[name.toLowerCase()] === "string") {
        return request.headers[name.toLowerCase()];
      }
      if (typeof request.get === "function") {
        return request.get(name) || request.get(name.toLowerCase());
      }
      return undefined;
    };

    const hmac = getHeader("X-Shopify-Hmac-Sha256");
    const topic = getHeader("X-Shopify-Topic");
    const webhookId = getHeader("X-Shopify-Webhook-Id");

    if (!hmac) {
      reply.status(401).send("Missing HMAC header");
      return;
    }

    if (!webhookId) {
      reply.status(400).send("Missing Webhook ID header");
      return;
    }

    const rawBodyStr = (request as any).rawBody
      ? (request as any).rawBody.toString("utf8")
      : (typeof request.body === "object" ? JSON.stringify(request.body) : String(request.body || ""));

    if (!this.security.validateHmac(rawBodyStr, hmac)) {
      reply.status(401).send("Invalid HMAC signature");
      return;
    }

    if (topic !== "orders/create") {
      reply.status(400).send("Unsupported topic");
      return;
    }

    try {
      // Check for duplicate processing
      if (await processedWebhookRepo.exists(webhookId)) {
        reply.status(200).send("Webhook already processed");
        return;
      }

      const order = (request.body as any);
      const lineItems = order.line_items || [];

      // Group by SKU to avoid race conditions when multiple line items have the same SKU
      const skuQuantities = new Map<string, number>();
      for (const item of lineItems) {
        if (item.sku) {
          const currentQty = skuQuantities.get(item.sku) ?? 0;
          skuQuantities.set(item.sku, currentQty + (item.quantity ?? 1));
        }
      }

      const dispatchPromises = [];
      for (const [sku, quantity] of skuQuantities.entries()) {
        // We skip publishing back to Shopify because this change originated from Shopify
        dispatchPromises.push(dispatchStock.execute(sku, quantity, "default", true));
      }
      await Promise.all(dispatchPromises);

      // Mark as processed
      await processedWebhookRepo.save(webhookId);

      reply.status(200).send("Webhook processed");
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "ShopifyWebhookController", message: "An error occurred", error: error.message });
        reply.status(400).send("A domain error occurred.");
      } else {
        Logger.error({ context: "ShopifyWebhookController", message: "Error processing Shopify webhook:", error: error });
        reply.status(500).send("Internal server error");
      }
    }
  }
}
