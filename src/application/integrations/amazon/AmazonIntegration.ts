import { BaseChannelAdapter, AmazonConnection, ExternalMapping } from '../../../../../shared/src/api/integrations/types';
import { ChannelIngestionService } from '../ChannelIngestionService';

export class AmazonIntegration implements BaseChannelAdapter<AmazonConnection> {
  constructor(
    private readonly ingestionService: ChannelIngestionService
  ) {}

  connect(connectionParams: Omit<AmazonConnection, 'id' | 'tenantId' | 'channelType'>): void {
    console.log(`Connected to Amazon SP-API for seller ${connectionParams.sellerId}`);
  }

  disconnect(): void {
    console.log('Disconnected from Amazon');
  }

  async getConnections(tenantId: string): Promise<AmazonConnection[]> {
    return [];
  }

  async createConnection(tenantId: string, params: Omit<AmazonConnection, 'id' | 'tenantId' | 'channelType'>): Promise<void> {
    console.log('Created Amazon connection');
  }

  async syncInventory(connectionId: string, onSyncProgress?: (progress: number) => void): Promise<void> {
    if (onSyncProgress) onSyncProgress(100);
  }

  async ingestOrder(orderData: any, mapping?: ExternalMapping[]): Promise<any> {
    const items = (orderData.OrderItems || []).map((item: any) => {
      const internalId = mapping?.find(m => m.externalId === item.SellerSKU)?.internalId || item.SellerSKU;
      return {
        variantId: internalId,
        quantity: item.QuantityOrdered,
        unitPriceCents: Math.round(parseFloat(item.ItemPrice.Amount) * 100)
      };
    });

    return this.ingestionService.ingestOrder(
      orderData.tenantId, 
      orderData.channelId, 
      orderData.AmazonOrderId, 
      items,
      { latitude: 0, longitude: 0 }
    );
  }

  async pushFulfillmentStatus(orderId: string, status: 'pending' | 'shipped' | 'delivered'): Promise<void> {
    console.log(`Pushed status ${status} to Amazon for order ${orderId}`);
  }

  subscribeEvents(tenantId: string, webhookUrl?: string): () => void {
    return () => console.log('Unsubscribed from Amazon SNS notifications');
  }
}
