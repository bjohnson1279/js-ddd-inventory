import { BaseChannelAdapter, ShopifyConnection, ExternalMapping } from '../../../../../shared/src/api/integrations/types';
import { ChannelIngestionService } from '../ChannelIngestionService';

export class ShopifyIntegration implements BaseChannelAdapter<ShopifyConnection> {
  constructor(
    private readonly ingestionService: ChannelIngestionService
  ) {}

  connect(connectionParams: Omit<ShopifyConnection, 'id' | 'tenantId' | 'channelType'>): void {
    console.log(`Connected to Shopify at ${connectionParams.domain}`);
  }

  disconnect(): void {
    console.log('Disconnected from Shopify');
  }

  async getConnections(tenantId: string): Promise<ShopifyConnection[]> {
    return [];
  }

  async createConnection(tenantId: string, params: Omit<ShopifyConnection, 'id' | 'tenantId' | 'channelType'>): Promise<void> {
    console.log('Created Shopify connection');
  }

  async syncInventory(connectionId: string, onSyncProgress?: (progress: number) => void): Promise<void> {
    if (onSyncProgress) onSyncProgress(100);
  }

  async ingestOrder(orderData: any, mapping?: ExternalMapping[]): Promise<any> {
    // 1. Parse Shopify REST payload
    const items = (orderData.line_items || []).map((item: any) => {
      // Find internal variant ID from mapping
      const internalId = mapping?.find(m => m.externalId === item.variant_id.toString())?.internalId || item.sku;
      return {
        variantId: internalId,
        quantity: item.quantity,
        unitPriceCents: Math.round(parseFloat(item.price) * 100)
      };
    });

    // 2. Pass to ingestion service
    // (Assuming we have tenantId and channelId from context)
    return this.ingestionService.ingestOrder(
      orderData.tenantId, 
      orderData.channelId, 
      orderData.id.toString(), 
      items,
      { latitude: 0, longitude: 0 } // Destination coordinates
    );
  }

  async pushFulfillmentStatus(orderId: string, status: 'pending' | 'shipped' | 'delivered'): Promise<void> {
    console.log(`Pushed status ${status} to Shopify for order ${orderId}`);
  }

  subscribeEvents(tenantId: string, webhookUrl?: string): () => void {
    return () => console.log('Unsubscribed from Shopify Webhooks');
  }
}
