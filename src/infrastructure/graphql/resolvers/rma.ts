import { IRMARepository } from "../../domain/repositories/IRMARepository";

interface RejectRMAItemDTO {
  itemId: string; // RMA item id, not variant id
  reason: string;
}

export interface RejectRMADTO {
  rmaNumber: string;
  items: RejectRMAItemDTO[];
}

export class GraphQLRMAResolver {
  constructor(private rmaRepo) {}

  async rejectRma({ rmaNumber, items }: RejectRMADTO): Promise<void> {
    const rma = await this.rmaRepo.get(rmaNumber);
    if (!rma) throw new Error("RMA not found");
    for (const item of rma.items) {
      await this.rmaRepo.rejectItem(item.id, item.reason);
    }
  }

  async updateRMAMapping(rmaNumber, warehouseId): Promise<void> {
    const rma = await this.rmaRepo.get(rmaNumber);
    if (!rma) throw new Error("RMA not found");
    for (const item of rma.items) {
      await this.rmaRepo.updateMapping(item.id, warehouseId);
    }
  }

  async processDisposition(rmaId, itemId, disposition): Promise<void> {
    const rma = await this.rmaRepo.get(rmaId);
    if (!rma) throw new Error("RMA not found");
    for (const item of rma.items) {
      if (item.id === itemId) {
        await this.rmaRepo.processDisposition(item.variantId, { disposition });
        return;  // Found and processed
      }
    }
    throw new Error("Item not found in RMA");
  }

  async trackInspectionNotes(rmaNumber, itemId, notes): Promise<void> {
    const rma = await this.rmaRepo.get(rmaNumber);
    if (!rma) throw new Error("RMA not found");
    for (const item of rma.items) {
      if (item.id === itemId) {
        await this.rmaRepo.trackInspectionNotes(rmaNumber, { itemId, notes });
        return;  // Found and tracked
      }
    }
    throw new Error("Item not found in RMA");
  }
}