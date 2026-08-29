import { BaseChannelAdapter } from '../../../../shared/src/api/integrations/types';

export class AmazonIntegration implements BaseChannelAdapter<any> {
  constructor(
    private readonly sellerId: string,
    private readonly mwsAuthToken: string,
    private readonly marketplaceId: string
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
