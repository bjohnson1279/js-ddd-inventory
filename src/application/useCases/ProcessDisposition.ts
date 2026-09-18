import { IRMARepository } from "../../domain/repositories/IRMARepository";

export interface ProcessDispositionDTO {
  rmaId: string;
  itemId: string;
  disposition: string; // RESTOCK | SCRAP | QUARANTINE
}

export class ProcessDisposition {
  constructor(private readonly rmaRepository) {}

  async execute(dto: ProcessDispositionDTO): Promise<void> {
    const rma = await this.rmaRepository.get(dto.rmaId);
    if (!rma) throw new Error("RMA " + dto.rmaId + " not found");
    for (const item of rma.items) {
      if (item.id !== dto.itemId) continue;
      await this.rmaRepository.processDisposition(item.variantId, { itemId: item.id, disposition: dto.disposition });
      return;  // Found and processed
    }
    throw new Error("Item " + dto.itemId + " not found in RMA");
  }
}