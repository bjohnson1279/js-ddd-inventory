export class DispatchRecord {
  constructor(
    public readonly id: string,
    public readonly sku: string,
    public readonly locationId: string,
    public readonly quantity: number,
    public readonly dispatchedAt: Date
  ) {}
}

export interface IDispatchRecordRepository {
  save(record: DispatchRecord, tx?: any): Promise<void>;
  fetchHistory(sku: string, locationId: string, since: Date): Promise<DispatchRecord[]>;
}
