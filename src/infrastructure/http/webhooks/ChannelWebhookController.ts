import { Request, Response } from 'express';
import { ChannelIngestionService } from '../../../application/integrations/ChannelIngestionService';
import { ShopifyIntegration } from '../../../application/integrations/shopify/ShopifyIntegration';
import { WooCommerceIntegration } from '../../../application/integrations/woocommerce/WooCommerceIntegration';
import { AmazonIntegration } from '../../../application/integrations/amazon/AmazonIntegration';

export class ChannelWebhookController {
  constructor(
    private readonly ingestionService: ChannelIngestionService,
    private readonly shopifyAdapter: ShopifyIntegration,
    private readonly wooCommerceAdapter: WooCommerceIntegration,
    private readonly amazonAdapter: AmazonIntegration
  ) {}

  public async handleShopifyOrder(req: Request, res: Response): Promise<void> {
    try {
      // Validate webhook signature here
      
      const payload = req.body;
      const tenantId = req.headers['x-tenant-id'] as string;
      const channelId = req.headers['x-channel-id'] as string;

      // Wrap payload with context expected by the adapter
      const orderData = {
        ...payload,
        tenantId,
        channelId
      };

      await this.shopifyAdapter.ingestOrder(orderData, []); // Empty mapping for now
      
      res.status(200).send('OK');
    } catch (error) {
      console.error('Failed to process Shopify webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  public async handleWooCommerceOrder(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body;
      const tenantId = req.headers['x-tenant-id'] as string;
      const channelId = req.headers['x-channel-id'] as string;

      const orderData = {
        ...payload,
        tenantId,
        channelId
      };

      await this.wooCommerceAdapter.ingestOrder(orderData, []);
      
      res.status(200).send('OK');
    } catch (error) {
      console.error('Failed to process WooCommerce webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  public async handleAmazonSnsNotification(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body;
      // Handle SNS Subscription confirmation or order notification
      
      const tenantId = req.headers['x-tenant-id'] as string;
      const channelId = req.headers['x-channel-id'] as string;

      const orderData = {
        ...payload,
        tenantId,
        channelId
      };

      await this.amazonAdapter.ingestOrder(orderData, []);
      
      res.status(200).send('OK');
    } catch (error) {
      console.error('Failed to process Amazon SNS webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}
