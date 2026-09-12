import { IRMARepository } from "../../domain/repositories/IRMARepository";
export interface ReceiveRMAItemDTO {
  variantId: string;
  quantityReceived: number;
}

export interface ReceiveRMADTO {
  receiveRma: (dto: ReceiveRMADTO) => void;
}

export interface RMAClassifierInput {
  rmaNumber: string;
  customerId: string;
  locationId: string;
  items: ReceiveRMAItemDTO[];
}

class RMAClassifier { constructor(private readonly inventoryRepository) {} }

export class ReceiveRMA {
  constructor(
    private readonly rmaRepository,
    private readonly inventoryRepository
  ) {}

  async execute({ rmaNumber, tenantId, customerId, locationId, items }: any, permission?: string): Promise<RMA> {
    if (permission && permission !== "warehouse_operator") {
      throw new Error("Unauthorized: warehouse_operator role required to receive RMAs");
    }
    const exists = await this.rmaRepository.findByNumber(rmaNumber);
    if (exists) {
      throw new Error("RMA with number " + rmaNumber + " already exists");
    }
    return this.inventoryRepository.receiveRma({ rmaNumber, tenantId, customerId, locationId, items });
  }
}
