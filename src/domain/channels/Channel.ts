export type ChannelType = 'shopify' | 'amazon' | 'woocommerce' | 'csv_edi';

export class Channel {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly name: string,
    public readonly type: ChannelType,
    public readonly isActive: boolean
  ) {}

  static create(id: string, tenantId: string, name: string, type: ChannelType): Channel {
    return new Channel(id, tenantId, name, type, true);
  }
}
