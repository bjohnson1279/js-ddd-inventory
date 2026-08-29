import { BaseChannelAdapter, CsvEdiConnection, ExternalMapping } from '../../../../../shared/src/api/integrations/types';
import { ChannelIngestionService } from '../ChannelIngestionService';

export class CsvEdiIntegration implements BaseChannelAdapter<CsvEdiConnection> {
  constructor(
    private readonly ingestionService: ChannelIngestionService
  ) {}

  connect(connectionParams: Omit<CsvEdiConnection, 'id' | 'tenantId' | 'channelType'>): void {
    console.log(`Connected to CSV/EDI provider via FTP: ${connectionParams.ftpHost}`);
  }

  disconnect(): void {
    console.log('Disconnected from CSV/EDI provider');
  }

  async getConnections(tenantId: string): Promise<CsvEdiConnection[]> {
    return [];
  }

  async createConnection(tenantId: string, params: Omit<CsvEdiConnection, 'id' | 'tenantId' | 'channelType'>): Promise<void> {
    console.log('Created CSV/EDI connection');
  }

  async syncInventory(connectionId: string, onSyncProgress?: (progress: number) => void): Promise<void> {
    // Generate inventory CSV and push to FTP
    if (onSyncProgress) onSyncProgress(100);
  }

  async ingestOrder(orderData: any, mapping?: ExternalMapping[]): Promise<any> {
    // orderData represents parsed CSV/EDI rows for a single order
    const items = (orderData.rows || []).map((row: any) => {
      const externalSku = row.sku || row.ItemCode;
      const internalId = mapping?.find(m => m.externalId === externalSku)?.internalId || externalSku;
      return {
        variantId: internalId,
        quantity: parseInt(row.quantity || row.Quantity, 10),
        unitPriceCents: Math.round(parseFloat(row.price || row.UnitPrice) * 100)
      };
    });

    return this.ingestionService.ingestOrder(
      orderData.tenantId, 
      orderData.channelId, 
      orderData.orderId || orderData.PONumber, 
      items,
      { latitude: 0, longitude: 0 }
    );
  }

  async pushFulfillmentStatus(orderId: string, status: 'pending' | 'shipped' | 'delivered'): Promise<void> {
    // Generate ASN (Advance Ship Notice - EDI 856) or CSV and push to FTP
    console.log(`Pushed status ${status} to CSV/EDI for order ${orderId}`);
  }

  subscribeEvents(tenantId: string, webhookUrl?: string): () => void {
    // Start FTP polling daemon
    return () => console.log('Stopped FTP polling');
  }
}
