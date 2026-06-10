import { IPurchaseOrderRepository } from "../../domain/repositories/IPurchaseOrderRepository";
import { PurchaseOrder } from "../../domain/procurement/aggregates/PurchaseOrder";
import { PurchaseOrderItem } from "../../domain/procurement/aggregates/PurchaseOrderItem";
import { PurchaseOrderStatus } from "../../domain/procurement/enums/PurchaseOrderStatus";
import { prisma } from "./prisma";

export class PrismaPurchaseOrderRepository implements IPurchaseOrderRepository {
  private prisma = prisma;

  private mapToDomain(record: any): PurchaseOrder {
    const items = (record.items || []).map((item: any) => 
      new PurchaseOrderItem(
        item.id,
        item.variantId,
        item.quantity,
        item.unitCostCents,
        item.receivedQuantity
      )
    );

    return new PurchaseOrder(
      record.id,
      record.purchaseOrderNumber,
      record.vendorId,
      record.tenantId,
      record.locationId,
      record.status as PurchaseOrderStatus,
      items
    );
  }

  async findById(id: string): Promise<PurchaseOrder | null> {
    const record = await this.prisma.purchaseOrderModel.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findByNumber(poNumber: string): Promise<PurchaseOrder | null> {
    const record = await this.prisma.purchaseOrderModel.findUnique({
      where: { purchaseOrderNumber: poNumber },
      include: { items: true }
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findAll(): Promise<PurchaseOrder[]> {
    const records = await this.prisma.purchaseOrderModel.findMany({
      include: { items: true }
    });
    return records.map(record => this.mapToDomain(record));
  }

  async save(po: PurchaseOrder): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Upsert Purchase Order
      await tx.purchaseOrderModel.upsert({
        where: { id: po.id },
        update: {
          status: po.status,
          vendorId: po.vendorId,
          locationId: po.locationId,
          tenantId: po.tenantId
        },
        create: {
          id: po.id,
          purchaseOrderNumber: po.purchaseOrderNumber,
          status: po.status,
          vendorId: po.vendorId,
          locationId: po.locationId,
          tenantId: po.tenantId
        }
      });

      // Upsert Purchase Order Items
      const itemOperations = po.items.map(item =>
        tx.purchaseOrderItemModel.upsert({
          where: { id: item.id },
          update: {
            receivedQuantity: item.receivedQuantity,
            quantity: item.quantity,
            unitCostCents: item.unitCostCents
          },
          create: {
            id: item.id,
            purchaseOrderId: po.id,
            variantId: item.variantId,
            quantity: item.quantity,
            receivedQuantity: item.receivedQuantity,
            unitCostCents: item.unitCostCents
          }
        })
      );
      await Promise.all(itemOperations);
    });
  }
}
