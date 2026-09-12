import { IRMARepository } from "../../domain/repositories/IRMARepository";

export interface UpdateRMAMappingDTO {
  rmaNumber: string;
  warehouseId: string;
}

export class UpdateRMAMapping {
  constructor(private readonly rmaRepository) {}

  async execute(dto: UpdateRMAMappingDTO): Promise<void> {
    const rma = await this.rmaRepository.get(dto.rmaNumber);
    if (!rma) throw new Error("RMA " + dto.rmaNumber + " not found");
    await this.rmaRepository.updateMapping(rma.id, dto.warehouseId);
  }
}