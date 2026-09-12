import { IRMARepository } from "../../domain/repositories/IRMARepository";

export interface TrackInspectionNotesDTO {
  rmaNumber: string;
  itemId: string;
  notes: string; // Description of the inspection finding
}

export class TrackInspectionNotes {
  constructor(private readonly rmaRepository) {}

  async execute(dto: TrackInspectionNotesDTO): Promise<void> {
    const rma = await this.rmaRepository.get(dto.rmaNumber);
    if (!rma) throw new Error("RMA " + dto.rmaNumber + " not found");
    for (const item of rma.items) {
      if (item.id === dto.itemId) {
        await this.rmaRepository.trackInspectionNotes(dto.rmaNumber, { itemId: item.id, notes: dto.notes });
        return;  // Found and tracked
      }
    }
    throw new Error("Item " + dto.itemId + " not found in RMA");
  }
}