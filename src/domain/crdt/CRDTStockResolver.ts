export interface LWWElement<T> {
  element: T;
  timestamp: number;
  nodeId: string;
}

export class CRDTStockResolver {
  public static mergeLWW<T>(current: LWWElement<T>, incoming: LWWElement<T>): LWWElement<T> {
    if (incoming.timestamp > current.timestamp) {
      return incoming;
    }
    if (incoming.timestamp === current.timestamp && incoming.nodeId > current.nodeId) {
      return incoming;
    }
    return current;
  }
}
