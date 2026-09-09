export interface BaseChannelAdapter<T> {
  syncInventory(): Promise<void>;
  ingestOrder(payload: T): Promise<void>;
  pushFulfillmentStatus(status: any): Promise<void>;
}
