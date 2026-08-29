export interface OrderLineItem {
  variantId: string;
  quantity: number;
  unitPriceCents: number;
}

export type OrderStatus = 'pending' | 'allocated' | 'shipped' | 'delivered' | 'canceled';

export class Order {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly channelId: string,
    public readonly externalOrderId: string,
    public status: OrderStatus,
    public readonly items: OrderLineItem[],
    public readonly createdAt: Date
  ) {}

  static create(
    id: string,
    tenantId: string,
    channelId: string,
    externalOrderId: string,
    items: OrderLineItem[]
  ): Order {
    return new Order(
      id,
      tenantId,
      channelId,
      externalOrderId,
      'pending',
      items,
      new Date()
    );
  }

  markAllocated(): void {
    if (this.status !== 'pending') {
      throw new Error(`Order ${this.id} cannot be allocated because it is ${this.status}`);
    }
    this.status = 'allocated';
  }

  markShipped(): void {
    if (this.status !== 'allocated') {
      throw new Error(`Order ${this.id} cannot be shipped because it is ${this.status}`);
    }
    this.status = 'shipped';
  }
}
