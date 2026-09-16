import { IRMARepository } from "../../domain/repositories/IRMARepository";
import { RMA } from "../../domain/returns/aggregates/RMA";
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

class RMAClassifier { constructor(private readonly inventoryRepository: any) {} }

export class ReceiveRMA {
  constructor(
    private readonly rmaRepository: any,
    private readonly inventoryRepository: any,
    private readonly costLayerRepository?: any,
    private readonly quarantineRepository?: any,
    private readonly tenantConfigRepository?: any,
    private readonly journalRepository?: any,
    private readonly serializedItemRepository?: any
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
