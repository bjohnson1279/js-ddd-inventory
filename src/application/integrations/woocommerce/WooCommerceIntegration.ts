import { BaseChannelAdapter } from '../../../../shared/src/api/integrations/types';

export class WooCommerceIntegration implements BaseChannelAdapter<any> {
  constructor(
    private readonly storeUrl: string,
    private readonly consumerKey: string,
    private readonly consumerSecret: string
  ) {}

  public async syncInventory(): Promise<void> {
    // Scaffold
  }

  public async ingestOrder(payload: any): Promise<void> {
    // Scaffold
  }

  public async pushFulfillmentStatus(status: any): Promise<void> {
    // Scaffold
  }
}
