import { ICarrierService, CarrierRate } from "../ports/ICarrierService";

export interface CalculateShippingRatesQuery {
  sku: string;
  quantity: number;
  destinationAddress: string;
}

export class CalculateShippingRates {
  constructor(private readonly carrierService: ICarrierService) {}

  async execute(query: CalculateShippingRatesQuery): Promise<CarrierRate[]> {
    const { sku, quantity, destinationAddress } = query;
    if (!sku || !destinationAddress) {
      throw new Error("Missing required rate fields: sku and destinationAddress.");
    }
    return this.carrierService.fetchRates(sku, quantity, destinationAddress);
  }
}
