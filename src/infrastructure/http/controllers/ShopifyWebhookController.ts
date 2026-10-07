import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { DispatchStock } from "../../../application/useCases/DispatchStock";
import { ShopifyWebhookSecurity } from "../../shopify/ShopifyWebhookSecurity";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { IProcessedWebhookRepository } from "../../../domain/repositories/IProcessedWebhookRepository";
import { DomainException } from "../../../domain/exceptions/DomainException";
import { Logger } from "../../../infrastructure/logging/logger";


export class ShopifyWebhookController {
  constructor(private readonly security: ShopifyWebhookSecurity) {}

  public async handleOrderCreated(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const repository = request.server["repository"] as IInventoryRepository;
    const processedWebhookRepo = req.app.get(
      "processedWebhookRepository",
    ) as IProcessedWebhookRepository;
    const reorderPolicyService = request.server["reorderPolicyService"];
    const dispatchRecordRepository = request.server["dispatchRecordRepository"];
    const dispatchStock = new DispatchStock(repository, undefined, reorderPolicyService, dispatchRecordRepository);

    const hmac = req.get("X-Shopify-Hmac-Sha256");
    const topic = req.get("X-Shopify-Topic");
    const webhookId = req.get("X-Shopify-Webhook-Id");

    if (!hmac) {
      reply.status(401).send("Missing HMAC header");
      return;
    }

    if (!webhookId) {
      reply.status(400).send("Missing Webhook ID header");
      return;
    }

    const rawBody = (req as any).rawBody;

    if (!rawBody || !this.security.validateHmac(rawBody.toString("utf8"), hmac)) {
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

      const order = request.body;
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
