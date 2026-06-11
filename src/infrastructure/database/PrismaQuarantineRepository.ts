import { IQuarantineRepository } from "../../domain/repositories/IQuarantineRepository";
import { QuarantineItem } from "../../domain/returns/aggregates/QuarantineItem";
import { QuarantineStatus } from "../../domain/returns/enums/QuarantineStatus";
import { prisma } from "./prisma";

export class PrismaQuarantineRepository implements IQuarantineRepository {
  private prisma = prisma;

  private mapToDomain(record: any): QuarantineItem {
    return new QuarantineItem(
      record.id,
      record.variantId,
      record.quantity,
      record.reason,
      record.locationId,
      record.tenantId,
      record.status as QuarantineStatus,
      record.createdAt,
      record.resolvedAt
    );
  }

  async findById(id: string): Promise<QuarantineItem | null> {
    const record = await this.prisma.quarantineItemModel.findUnique({
      where: { id }
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findAll(): Promise<QuarantineItem[]> {
    const records = await this.prisma.quarantineItemModel.findMany();
    return records.map(record => this.mapToDomain(record));
  }

  async save(item: QuarantineItem): Promise<void> {
    await this.prisma.quarantineItemModel.upsert({
      where: { id: item.id },
      update: {
        status: item.status,
        resolvedAt: item.resolvedAt
      },
      create: {
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        reason: item.reason,
        locationId: item.locationId,
        tenantId: item.tenantId,
        status: item.status,
        createdAt: item.createdAt,
        resolvedAt: item.resolvedAt
      }
    });
  }
}
