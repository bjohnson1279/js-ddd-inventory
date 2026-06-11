import { IDispatchRecordRepository, DispatchRecord } from "../../domain/repositories/IDispatchRecordRepository";
import { prisma } from "./prisma";

export class PrismaDispatchRecordRepository implements IDispatchRecordRepository {
  private prisma = prisma;

  async save(record: DispatchRecord, tx?: any): Promise<void> {
    const client = tx || this.prisma;
    await client.dispatchRecordModel.create({
      data: {
        sku: record.sku,
        locationId: record.locationId,
        quantity: record.quantity,
        dispatchedAt: record.dispatchedAt
      }
    });
  }

  async fetchHistory(sku: string, locationId: string, since: Date): Promise<DispatchRecord[]> {
    const records = await this.prisma.dispatchRecordModel.findMany({
      where: {
        sku,
        locationId,
        dispatchedAt: {
          gte: since
        }
      },
      orderBy: { dispatchedAt: "asc" }
    });

    return records.map(
      (r) => new DispatchRecord(r.id, r.sku, r.locationId, r.quantity, r.dispatchedAt)
    );
  }
}
