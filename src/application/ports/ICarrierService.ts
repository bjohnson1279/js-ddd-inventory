export interface CarrierRate {
  carrier: string;
  rateCents: number;
  estimatedDays: number;
}

export interface LabelResult {
  trackingNumber: string;
  labelUrl: string;
  rateCents: number;
}

export interface ICarrierService {
  fetchRates(sku: string, quantity: number, destinationAddress: string, originLocationId?: string): Promise<CarrierRate[]>;
  generateLabel(sku: string, quantity: number, destinationAddress: string, carrier: string, originLocationId?: string): Promise<LabelResult>;
}
