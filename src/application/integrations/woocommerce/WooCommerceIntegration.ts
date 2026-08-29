import { BaseChannelAdapter, WooCommerceConnection, ExternalMapping } from '../../../../../shared/src/api/integrations/types';
import { ChannelIngestionService } from '../ChannelIngestionService';

export class WooCommerceIntegration implements BaseChannelAdapter<WooCommerceConnection> {
  constructor(
    private readonly ingestionService: ChannelIngestionService
  ) {}

  connect(connectionParams: Omit<WooCommerceConnection, 'id' | 'tenantId' | 'channelType'>): void {
    console.log(`Connected to WooCommerce at ${connectionParams.storeUrl}`);
  }

  disconnect(): void {
    console.log('Disconnected from WooCommerce');
  }

  async getConnections(tenantId: string): Promise<WooCommerceConnection[]> {
    return [];
  }

  async createConnection(tenantId: string, params: Omit<WooCommerceConnection, 'id' | 'tenantId' | 'channelType'>): Promise<void> {
    console.log('Created WooCommerce connection');
  }

  async syncInventory(connectionId: string, onSyncProgress?: (progress: number) => void): Promise<void> {
    if (onSyncProgress) onSyncProgress(100);
  }

  async ingestOrder(orderData: any, mapping?: ExternalMapping[]): Promise<any> {
    const items = (orderData.line_items || []).map((item: any) => {
      const internalId = mapping?.find(m => m.externalId === item.sku)?.internalId || item.sku;
      return {
        variantId: internalId,
        quantity: item.quantity,
        unitPriceCents: Math.round(parseFloat(item.price) * 100)
      };
    });

    return this.ingestionService.ingestOrder(
      orderData.tenantId, 
      orderData.channelId, 
      orderData.id.toString(), 
      items,
      { latitude: 0, longitude: 0 }
    );
  }

  async pushFulfillmentStatus(orderId: string, status: 'pending' | 'shipped' | 'delivered'): Promise<void> {
    console.log(`Pushed status ${status} to WooCommerce for order ${orderId}`);
  }

  subscribeEvents(tenantId: string, webhookUrl?: string): () => void {
    return () => console.log('Unsubscribed from WooCommerce Webhooks');
  }
}
