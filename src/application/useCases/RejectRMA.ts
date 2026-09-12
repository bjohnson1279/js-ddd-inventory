import { RMA } from "../returns/aggregates/RMA";

export interface RejectRMAItemDTO {
  itemId: string; // RMA item id, not variant id
  reason: string;
}

export interface RejectRMADTO {
  rmaNumber: string;
  items: RejectRMAItemDTO[];
}

export class RejectRMA {
  constructor(private readonly rmaRepository) {}

  async execute({ rmaNumber }: RejectRMADTO): Promise<void> {
    const rma = await this.rmaRepository.get(rmaNumber);
    if (!rma) throw new Error("RMA " + rmaNumber + " not found");
    for (const item of rma.items) {
      await this.rmaRepository.rejectItem(item.id, reason: item.reason);
    }
  }
}