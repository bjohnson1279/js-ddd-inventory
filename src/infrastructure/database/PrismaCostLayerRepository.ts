import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { InventoryCostLayer } from "../../domain/accounting/entities/InventoryCostLayer";
import { prisma } from "./prisma";

export class PrismaCostLayerRepository implements ICostLayerRepository {
  private prisma = prisma;

  private mapToDomain(record: any): InventoryCostLayer {
    const layer = new InventoryCostLayer(
      record.id,
      record.variantId,
      record.tenantId,
      record.originalQuantity,
      record.unitCostCents,
      record.receivedAt,
      record.purchaseOrderId
    );

    // Reconstitute the private remaining quantity field from the database
    (layer as any)._remainingQuantity = record.remainingQuantity;

    return layer;
  }

  async getActiveLayers(
    variantId: string,
    orderBy?: "asc" | "desc"
  ): Promise<InventoryCostLayer[]> {
    const records = await this.prisma.inventoryCostLayerModel.findMany({
      where: {
        variantId,
        remainingQuantity: { gt: 0 },
      },
      orderBy: orderBy ? { receivedAt: orderBy } : undefined,
    });

    return records.map((r) => this.mapToDomain(r));
  }

  async save(layer: InventoryCostLayer): Promise<void> {
    await this.prisma.inventoryCostLayerModel.upsert({
      where: { id: layer.id },
      update: {
        variantId: layer.variantId,
        tenantId: layer.tenantId,
        originalQuantity: layer.originalQuantity,
        remainingQuantity: layer.remainingQuantity,
        unitCostCents: layer.unitCostCents,
        receivedAt: layer.receivedAt,
        purchaseOrderId: layer.purchaseOrderId,
        isConsumed: layer.isExhausted(),
      },
      create: {
        id: layer.id,
        variantId: layer.variantId,
        tenantId: layer.tenantId,
        originalQuantity: layer.originalQuantity,
        remainingQuantity: layer.remainingQuantity,
        unitCostCents: layer.unitCostCents,
        receivedAt: layer.receivedAt,
        purchaseOrderId: layer.purchaseOrderId,
        isConsumed: layer.isExhausted(),
      },
    });
  }
}
