import { IInventoryAuditRepository } from "../../domain/repositories/IInventoryAuditRepository";
import { InventoryAudit } from "../../domain/procurement/aggregates/InventoryAudit";
import { InventoryAuditItem } from "../../domain/procurement/aggregates/InventoryAuditItem";
import { AuditStatus } from "../../domain/procurement/enums/AuditStatus";
import { InventoryAuditModel, InventoryAuditItemModel } from "@prisma/client";

type InventoryAuditRecord = InventoryAuditModel & { items: InventoryAuditItemModel[] };

import { PrismaBaseRepository } from "./PrismaBaseRepository";

export class PrismaInventoryAuditRepository extends PrismaBaseRepository implements IInventoryAuditRepository {

  private mapToDomain(record: InventoryAuditRecord): InventoryAudit {
    const items = (record.items || []).map((item) =>
      new InventoryAuditItem(
        item.id,
        item.variantId,
        item.expectedQuantity,
        item.countedQuantity,
        item.isCounted
      )
    );

    return new InventoryAudit(
      record.id,
      record.auditNumber,
      record.tenantId,
      record.locationId,
      record.status as AuditStatus,
      items,
      record.createdAt,
      record.updatedAt
    );
  }

  async findById(id: string): Promise<InventoryAudit | null> {
    const record = await this.prisma.inventoryAuditModel.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findByNumber(auditNumber: string): Promise<InventoryAudit | null> {
    const record = await this.prisma.inventoryAuditModel.findUnique({
      where: { auditNumber },
      include: { items: true }
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findAll(): Promise<InventoryAudit[]> {
    const records = await this.prisma.inventoryAuditModel.findMany({
      include: { items: true }
    });
    return records.map(record => this.mapToDomain(record));
  }

  async save(audit: InventoryAudit): Promise<void> {
    await this.prisma.inventoryAuditModel.upsert({
      where: { id: audit.id },
      update: {
        status: audit.status,
        tenantId: audit.tenantId,
        locationId: audit.locationId,
        items: {
          upsert: audit.items.map(item => ({
            where: { id: item.id },
            update: {
              countedQuantity: item.countedQuantity,
              isCounted: item.isCounted,
              expectedQuantity: item.expectedQuantity
            },
            create: {
              id: item.id,
              variantId: item.variantId,
              expectedQuantity: item.expectedQuantity,
              countedQuantity: item.countedQuantity,
              isCounted: item.isCounted
            }
          }))
        }
},
      create: {
        id: audit.id,
        auditNumber: audit.auditNumber,
        status: audit.status,
        tenantId: audit.tenantId,
        locationId: audit.locationId,
        items: {
          create: audit.items.map(item => ({
            id: item.id,
            variantId: item.variantId,
            expectedQuantity: item.expectedQuantity,
            countedQuantity: item.countedQuantity,
            isCounted: item.isCounted
          }))
        }
}
    });
  }
}
