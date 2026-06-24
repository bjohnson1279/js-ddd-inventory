import { Request, Response } from "express";
import { DispatchStock } from "../../../application/useCases/DispatchStock";
import { ShopifyWebhookSecurity } from "../../shopify/ShopifyWebhookSecurity";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { IProcessedWebhookRepository } from "../../../domain/repositories/IProcessedWebhookRepository";
import { DomainException } from "../../../domain/exceptions/DomainException";


export class ShopifyWebhookController {
  constructor(private readonly security: ShopifyWebhookSecurity) {}

  public async handleOrderCreated(req: Request, res: Response): Promise<void> {
    const repository = req.app.get("repository") as IInventoryRepository;
    const processedWebhookRepo = req.app.get(
      "processedWebhookRepository",
    ) as IProcessedWebhookRepository;
    const reorderPolicyService = req.app.get("reorderPolicyService");
    const dispatchRecordRepository = req.app.get("dispatchRecordRepository");
    const dispatchStock = new DispatchStock(repository, undefined, reorderPolicyService, dispatchRecordRepository);

    const hmac = req.get("X-Shopify-Hmac-Sha256");
    const topic = req.get("X-Shopify-Topic");
    const webhookId = req.get("X-Shopify-Webhook-Id");

    if (!hmac) {
      res.status(401).send("Missing HMAC header");
      return;
    }

    if (!webhookId) {
      res.status(400).send("Missing Webhook ID header");
      return;
    }

    const rawBody = (req as any).rawBody;

    if (!rawBody || !this.security.validateHmac(rawBody.toString("utf8"), hmac)) {
      res.status(401).send("Invalid HMAC signature");
      return;
    }

    if (topic !== "orders/create") {
      res.status(400).send("Unsupported topic");
      return;
    }

    try {
      // Check for duplicate processing
      if (await processedWebhookRepo.exists(webhookId)) {
        res.status(200).send("Webhook already processed");
        return;
      }

      const order = req.body;
      const lineItems = order.line_items || [];

      // Group identical SKUs to prevent race conditions
      const skuQuantities = new Map<string, number>();
      for (const item of lineItems) {
        if (item.sku) {
          const currentQty = skuQuantities.get(item.sku) || 0;
          skuQuantities.set(item.sku, currentQty + (Number(item.quantity) || 0));
        }
      }

      const dispatchPromises = [];
      for (const [sku, quantity] of skuQuantities.entries()) {
        if (quantity > 0) {
          // We skip publishing back to Shopify because this change originated from Shopify
          dispatchPromises.push(dispatchStock.execute(sku, quantity, "default", true));
        }
      }
      await Promise.all(dispatchPromises);

      // Mark as processed
      await processedWebhookRepo.save(webhookId);

      res.status(200).send("Webhook processed");
    } catch (error: any) {
      if (error instanceof DomainException) {
        res.status(400).send(error.message);
      } else {
        console.error("Error processing Shopify webhook:", error);
        res.status(500).send("Internal server error");
      }
    }
  }
}
