import { Request, Response } from 'express';
import { DispatchStock } from '../../../application/useCases/DispatchStock';
import { ShopifyWebhookSecurity } from '../../shopify/ShopifyWebhookSecurity';
import { IInventoryRepository } from '../../../domain/repositories/IInventoryRepository';
import { IProcessedWebhookRepository } from '../../../domain/repositories/IProcessedWebhookRepository';

export class ShopifyWebhookController {
  constructor(
    private readonly security: ShopifyWebhookSecurity
  ) {}

  public async handleOrderCreated(req: Request, res: Response): Promise<void> {
    const repository = req.app.get("repository") as IInventoryRepository;
    const processedWebhookRepo = req.app.get("processedWebhookRepository") as IProcessedWebhookRepository;
    const dispatchStock = new DispatchStock(repository);
    
    const hmac = req.get('X-Shopify-Hmac-Sha256');
    const topic = req.get('X-Shopify-Topic');
    const webhookId = req.get('X-Shopify-Webhook-Id');

    if (!hmac) {
      res.status(401).send('Missing HMAC header');
      return;
    }

    if (!webhookId) {
      res.status(400).send('Missing Webhook ID header');
      return;
    }

    const rawBody = JSON.stringify(req.body); 

    if (!this.security.validateHmac(rawBody, hmac)) {
      res.status(401).send('Invalid HMAC signature');
      return;
    }

    if (topic !== 'orders/create') {
      res.status(400).send('Unsupported topic');
      return;
    }

    try {
      // Check for duplicate processing
      if (await processedWebhookRepo.exists(webhookId)) {
        res.status(200).send('Webhook already processed');
        return;
      }

      const order = req.body;
      const lineItems = order.line_items || [];

      for (const item of lineItems) {
        if (item.sku) {
          // We skip publishing back to Shopify because this change originated from Shopify
          await dispatchStock.execute(item.sku, item.quantity, true);
        }
      }

      // Mark as processed
      await processedWebhookRepo.save(webhookId);

      res.status(200).send('Webhook processed');
    } catch (error: any) {
      console.error('Error processing Shopify webhook:', error);
      res.status(500).send('Internal server error');
    }
  }
}
