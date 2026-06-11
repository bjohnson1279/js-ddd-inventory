import { IDispatchRecordRepository, DispatchRecord } from "../../domain/repositories/IDispatchRecordRepository";

export class InMemoryDispatchRecordRepository implements IDispatchRecordRepository {
  public records: DispatchRecord[] = [];

  async save(record: DispatchRecord, tx?: any): Promise<void> {
    this.records.push(new DispatchRecord(
      Math.random().toString(36).substring(2, 11),
      record.sku,
      record.locationId,
      record.quantity,
      record.dispatchedAt
    ));
  }

  async fetchHistory(sku: string, locationId: string, since: Date): Promise<DispatchRecord[]> {
    return this.records.filter(
      (r) => r.sku === sku && r.locationId === locationId && r.dispatchedAt >= since
    );
  }
}
