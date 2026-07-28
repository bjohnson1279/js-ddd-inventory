import { LotBatch, LotStatus } from '../entities/LotBatch';

export interface LotTraceabilityReport {
  lotNumber: string;
  variantId: string;
  status: LotStatus;
  quarantineReason?: string;
  affectedCostLayersCount: number;
  affectedOrders: Array<{ orderId: string; quantity: number }>;
  affectedCustomers: string[];
}

export class LotRecallService {
  public static generateTraceabilityReport(
    lot: LotBatch,
    costLayers: Array<{ id: string; remainingQuantity: number; originalQuantity: number }>,
    fulfilledShipments: Array<{ id: string; sku: string; destinationAddress: string; quantity: number }>
  ): LotTraceabilityReport {
    const affectedOrders = fulfilledShipments.map(s => ({
      orderId: s.id,
      quantity: s.quantity,
    }));

    const customerSet = new Set(fulfilledShipments.map(s => s.destinationAddress).filter(Boolean));

    return {
      lotNumber: lot.lotNumber,
      variantId: lot.variantId,
      status: lot.status,
      quarantineReason: lot.quarantineReason,
      affectedCostLayersCount: costLayers.length,
      affectedOrders,
      affectedCustomers: Array.from(customerSet),
    };
  }
}
