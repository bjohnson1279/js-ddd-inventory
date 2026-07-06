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
      record.purchaseOrderId,
      record.locationId,
      record.lotNumber,
      record.expirationDate
    );

    // Reconstitute the private remaining quantity field from the database
    (layer as any)._remainingQuantity = record.remainingQuantity;

    return layer;
  }

  async getActiveLayers(
    variantId: string,
    orderBy?: string
  ): Promise<InventoryCostLayer[]> {
    const isExpiration = orderBy?.toLowerCase().includes("expiration");
    const orderDirection = orderBy?.toLowerCase().includes("desc") ? "desc" : "asc";

    const records = await this.prisma.inventoryCostLayerModel.findMany({
      where: {
        variantId,
        remainingQuantity: { gt: 0 },
      },
      orderBy: isExpiration
        ? [
            { expirationDate: orderDirection },
            { receivedAt: "asc" }
          ]
        : orderBy
        ? {
            receivedAt: orderDirection as any,
          }
        : undefined,
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
        locationId: layer.locationId || null,
        isConsumed: layer.isExhausted(),
        lotNumber: layer.lotNumber || null,
        expirationDate: layer.expirationDate || null,
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
        locationId: layer.locationId || null,
        isConsumed: layer.isExhausted(),
        lotNumber: layer.lotNumber || null,
        expirationDate: layer.expirationDate || null,
      },
    });
  }

  async saveMany(layers: InventoryCostLayer[]): Promise<void> {
    if (layers.length === 0) return;

    await this.prisma.$transaction(
      layers.map((layer) =>
        this.prisma.inventoryCostLayerModel.upsert({
          where: { id: layer.id },
          update: {
            variantId: layer.variantId,
            tenantId: layer.tenantId,
            originalQuantity: layer.originalQuantity,
            remainingQuantity: layer.remainingQuantity,
            unitCostCents: layer.unitCostCents,
            receivedAt: layer.receivedAt,
            purchaseOrderId: layer.purchaseOrderId,
            locationId: layer.locationId || null,
            isConsumed: layer.isExhausted(),
            lotNumber: layer.lotNumber || null,
            expirationDate: layer.expirationDate || null,
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
            locationId: layer.locationId || null,
            isConsumed: layer.isExhausted(),
            lotNumber: layer.lotNumber || null,
            expirationDate: layer.expirationDate || null,
          },
        })
      )
    );
  }
}
