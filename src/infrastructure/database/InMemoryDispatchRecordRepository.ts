import { IDispatchRecordRepository, DispatchRecord } from "../../domain/repositories/IDispatchRecordRepository";

export class InMemoryDispatchRecordRepository implements IDispatchRecordRepository {
  public records: DispatchRecord[] = [];

  async save(record: DispatchRecord, tx?: any): Promise<void> {
    this.records.push(new DispatchRecord(
      crypto.randomUUID(),
      record.sku,
      record.locationId,
      record.quantity,
      record.dispatchedAt,
      record.lotNumber
    ));
  }

  async fetchHistory(sku: string, locationId: string, since: Date): Promise<DispatchRecord[]> {
    return this.records.filter(
      (r) => r.sku === sku && r.locationId === locationId && r.dispatchedAt >= since
    );
  }

  async fetchByLotNumber(lotNumber: string): Promise<DispatchRecord[]> {
    return this.records.filter((r) => r.lotNumber === lotNumber);
  }
}
