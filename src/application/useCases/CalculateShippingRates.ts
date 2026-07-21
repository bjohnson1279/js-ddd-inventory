import { ICarrierService, CarrierRate } from "../ports/ICarrierService";

export interface CalculateShippingRatesQuery {
  sku: string;
  quantity: number;
  destinationAddress: string;
}

export class CalculateShippingRates {
  constructor(private readonly carrierService: ICarrierService) {}

  async execute(query: CalculateShippingRatesQuery): Promise<CarrierRate[]> {
    if (!query) {
      throw new Error("Missing query.");
    }

    const { sku, quantity, destinationAddress } = query;

    if (!sku || typeof sku !== 'string' || sku.trim() === "" || !destinationAddress || typeof destinationAddress !== 'string' || destinationAddress.trim() === "") {
      throw new Error("Missing required rate fields: sku and destinationAddress.");
    }

    if (quantity === undefined || quantity === null || typeof quantity !== 'number' || quantity <= 0 || isNaN(quantity)) {
      throw new Error("Invalid quantity.");
    }

    return this.carrierService.fetchRates(sku, quantity, destinationAddress);
  }
}
