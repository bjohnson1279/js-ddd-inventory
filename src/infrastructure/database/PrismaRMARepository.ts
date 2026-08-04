import { IRMARepository } from "../../domain/repositories/IRMARepository";
import { RMA } from "../../domain/returns/aggregates/RMA";
import { RMAItem } from "../../domain/returns/entities/RMAItem";
import { RMAStatus } from "../../domain/returns/enums/RMAStatus";
import { RMAItemStatus } from "../../domain/returns/enums/RMAItemStatus";
import { RMADisposition } from "../../domain/returns/enums/RMADisposition";
import { prisma } from "./prisma";

export class PrismaRMARepository implements IRMARepository {
  private prisma = prisma;

  private mapToDomain(record: any): RMA {
    const items = (record.items || []).map((item: any) => 
      new RMAItem(
        item.id,
        item.variantId,
        item.quantity,
        item.unitCostCents,
        item.receivedQuantity,
        item.status as RMAItemStatus,
        item.disposition as RMADisposition | null
      )
    );

    return new RMA(
      record.id,
      record.rmaNumber,
      record.tenantId,
      record.customerId,
      record.locationId,
      record.status as RMAStatus,
      items,
      record.createdAt,
      record.updatedAt
    );
  }

  async findById(id: string): Promise<RMA | null> {
    const record = await this.prisma.rMAModel.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findByNumber(rmaNumber: string): Promise<RMA | null> {
    const record = await this.prisma.rMAModel.findUnique({
      where: { rmaNumber },
      include: { items: true }
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findAll(): Promise<RMA[]> {
    const records = await this.prisma.rMAModel.findMany({
      include: { items: true }
    });
    return records.map(record => this.mapToDomain(record));
  }

  async save(rma: RMA): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Upsert RMA aggregate root
      await tx.rMAModel.upsert({
        where: { id: rma.id },
        update: {
          status: rma.status,
          customerId: rma.customerId,
          locationId: rma.locationId,
          tenantId: rma.tenantId
        },
        create: {
          id: rma.id,
          rmaNumber: rma.rmaNumber,
          status: rma.status,
          customerId: rma.customerId,
          locationId: rma.locationId,
          tenantId: rma.tenantId
        }
      });

      // Upsert RMA items
      for (const item of rma.items) {
        await tx.rMAItemModel.upsert({
          where: { id: item.id },
          update: {
            receivedQuantity: item.receivedQuantity,
            status: item.status,
            disposition: item.disposition
          },
          create: {
            id: item.id,
            rmaId: rma.id,
            variantId: item.variantId,
            quantity: item.quantity,
            receivedQuantity: item.receivedQuantity,
            unitCostCents: item.unitCostCents,
            status: item.status,
            disposition: item.disposition
          }
        });
      }
    });
  }
}
