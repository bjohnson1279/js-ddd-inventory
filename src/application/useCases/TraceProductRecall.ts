import { IDispatchRecordRepository } from "../../domain/repositories/IDispatchRecordRepository";

export interface ContaminatedDispatch {
  ledgerEntryId: string; // Map to DispatchRecord.id
  locationId: string;
  quantity: number;
  occurredAt: Date;
  lotNumber: string;
}

export class TraceProductRecall {
  constructor(private readonly dispatchRecordRepository: IDispatchRecordRepository) {}

  async execute(lotNumber: string): Promise<ContaminatedDispatch[]> {
    if (!lotNumber || lotNumber.trim().length === 0) {
      throw new Error("Lot number cannot be empty.");
    }

    const records = await this.dispatchRecordRepository.fetchByLotNumber(lotNumber);

    return records.map((r) => ({
      ledgerEntryId: r.id,
      locationId: r.locationId,
      quantity: r.quantity,
      occurredAt: r.dispatchedAt,
      lotNumber: r.lotNumber || lotNumber
    }));
  }
}
