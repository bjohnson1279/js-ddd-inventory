import { IRMARepository } from "../../domain/repositories/IRMARepository";
import { RMA } from "../../domain/returns/aggregates/RMA";
import { RMAItem } from "../../domain/returns/entities/RMAItem";
import { RMAStatus } from "../../domain/returns/enums/RMAStatus";

export interface CreateRMAItemDTO {
  variantId: string;
  quantity: number;
  unitCostCents: number;
}

export interface CreateRMADTO {
  rmaNumber: string;
  tenantId: string;
  customerId: string;
  locationId: string;
  items: CreateRMAItemDTO[];
}

export class CreateRMA {
  constructor(private readonly rmaRepository: IRMARepository) {}

  async execute(dto: CreateRMADTO): Promise<RMA> {
    const existing = await this.rmaRepository.findByNumber(dto.rmaNumber);
    if (existing) {
      throw new Error(`RMA with number ${dto.rmaNumber} already exists.`);
    }

    const items = dto.items.map(
      (item) =>
        new RMAItem(
          crypto.randomUUID(),
          item.variantId,
          item.quantity,
          item.unitCostCents
        )
    );

    const rma = new RMA(
      crypto.randomUUID(),
      dto.rmaNumber,
      dto.tenantId,
      dto.customerId,
      dto.locationId,
      RMAStatus.Requested,
      items
    );

    await this.rmaRepository.save(rma);
    return rma;
  }
}
