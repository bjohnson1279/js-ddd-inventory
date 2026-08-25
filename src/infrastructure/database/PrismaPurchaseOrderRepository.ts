import { IPurchaseOrderRepository } from "../../domain/repositories/IPurchaseOrderRepository";
import { PurchaseOrder } from "../../domain/procurement/aggregates/PurchaseOrder";
import { PurchaseOrderItem } from "../../domain/procurement/aggregates/PurchaseOrderItem";
import { PurchaseOrderStatus } from "../../domain/procurement/enums/PurchaseOrderStatus";
import { Prisma } from "@prisma/client";

type PurchaseOrderRecord = Prisma.PurchaseOrderModelGetPayload<{
  include: { items: true };
}>;

import { PrismaBaseRepository } from "./PrismaBaseRepository";

export class PrismaPurchaseOrderRepository extends PrismaBaseRepository implements IPurchaseOrderRepository {

  private mapToDomain(record: PurchaseOrderRecord): PurchaseOrder {
    const items = (record.items || []).map(item =>
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
      items,
      record.createdAt,
      record.updatedAt
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
    // ⚡ Bolt Optimization: Replace loop of independent DB ops inside $transaction with a nested Prisma relation write
    // 🎯 Impact: Reduces N+1 queries for purchase order items down to 1 operation (O(1)), cutting DB I/O latency.
    await this.prisma.purchaseOrderModel.upsert({
      where: { id: po.id },
      update: {
        status: po.status,
        vendorId: po.vendorId,
        locationId: po.locationId,
        tenantId: po.tenantId,
        items: {
          upsert: po.items.map(item => ({
            where: { id: item.id },
            update: {
              receivedQuantity: item.receivedQuantity,
              quantity: item.quantity,
              unitCostCents: item.unitCostCents
            },
            create: {
              id: item.id,
              variantId: item.variantId,
              quantity: item.quantity,
              receivedQuantity: item.receivedQuantity,
              unitCostCents: item.unitCostCents
            }
          }))
        }
      },
      create: {
        id: po.id,
        purchaseOrderNumber: po.purchaseOrderNumber,
        status: po.status,
        vendorId: po.vendorId,
        locationId: po.locationId,
        tenantId: po.tenantId,
        items: {
          create: po.items.map(item => ({
            id: item.id,
            variantId: item.variantId,
            quantity: item.quantity,
            receivedQuantity: item.receivedQuantity,
            unitCostCents: item.unitCostCents
          }))
        }
      }
    });
  }
}
