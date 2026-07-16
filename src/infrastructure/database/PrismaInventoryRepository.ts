import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { DomainEventDispatcher } from "../../domain/events/DomainEventDispatcher";
import { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";
import { ConcurrencyException } from "../../domain/exceptions/ConcurrencyException";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { WebSocketManager } from "../websocket/WebSocketManager";
import { tenantLocalStorage } from "./tenantContext";
import { ComplianceLedgerService } from "../../domain/services/ComplianceLedgerService";

export class PrismaInventoryRepository implements IInventoryRepository {
  private readonly prisma = prisma;

  constructor(
    private readonly outboxRepository?: IOutboxRepository
  ) {}

  async findBySku(sku: SKU, locationId?: string): Promise<InventoryItem | null> {
    let record;
    if (locationId) {
      record = await this.prisma.inventoryModel.findUnique({
        where: {
          sku_locationId: {
            sku: sku.getValue(),
            locationId
          }
        }
      });
    } else {
      record = await this.prisma.inventoryModel.findFirst({
        where: { sku: sku.getValue() }
      });
    }

    if (!record) return null;

    return InventoryItem.create(
      record.id,
      SKU.create(record.sku),
      record.locationId,
      Quantity.create(record.quantity),
      Quantity.create(record.allocated),
      Quantity.create(record.inTransit),
      record.version
    );
  }

  async findAllBySku(sku: SKU): Promise<InventoryItem[]> {
    const records = await this.prisma.inventoryModel.findMany({
      where: { sku: sku.getValue() }
    });

    return records.map((record: any) =>
      InventoryItem.create(
        record.id,
        SKU.create(record.sku),
        record.locationId,
        Quantity.create(record.quantity),
        Quantity.create(record.allocated),
        Quantity.create(record.inTransit),
        record.version
      )
    );
  }

  async findBySkus(skus: SKU[], locationId: string = "default"): Promise<InventoryItem[]> {
    const records = await this.prisma.inventoryModel.findMany({
      where: {
        sku: { in: skus.map(s => s.getValue()) },
        locationId
      }
    });

    return records.map((record: { id: string; sku: string; locationId: string; quantity: number; allocated: number; inTransit: number; version: number }) =>
      InventoryItem.create(
        record.id,
        SKU.create(record.sku),
        record.locationId,
        Quantity.create(record.quantity),
        Quantity.create(record.allocated),
        Quantity.create(record.inTransit),
        record.version
      )
    );
  }

  async findAll(): Promise<InventoryItem[]> {
    const records = await this.prisma.inventoryModel.findMany();
    return records.map((record: { id: string; sku: string; locationId: string; quantity: number; allocated: number; inTransit: number; version: number }) =>
      InventoryItem.create(
        record.id,
        SKU.create(record.sku),
        record.locationId,
        Quantity.create(record.quantity),
        Quantity.create(record.allocated),
        Quantity.create(record.inTransit),
        record.version
      )
    );
  }

  async findAllByLocation(locationId: string): Promise<InventoryItem[]> {
    const records = await this.prisma.inventoryModel.findMany({
      where: { locationId }
    });
    return records.map((record: { id: string; sku: string; locationId: string; quantity: number; allocated: number; inTransit: number; version: number }) =>
      InventoryItem.create(
        record.id,
        SKU.create(record.sku),
        record.locationId,
        Quantity.create(record.quantity),
        Quantity.create(record.allocated),
        Quantity.create(record.inTransit),
        record.version
      )
    );
  }

  async save(item: InventoryItem): Promise<void> {
    const events = item.getDomainEvents();

    if (this.outboxRepository) {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const existing = await tx.inventoryModel.findUnique({
          where: { id: item.id }
        });

        if (!existing) {
          await tx.inventoryModel.create({
            data: {
              id: item.id,
              sku: item.sku.getValue(),
              locationId: item.locationId,
              quantity: item.quantity.getValue(),
              allocated: item.allocated.getValue(),
              inTransit: item.inTransit.getValue(),
              version: item.version
            }
          });
        } else {
          const result = await tx.inventoryModel.updateMany({
            where: {
              id: item.id,
              version: item.version - 1
            },
            data: {
              quantity: item.quantity.getValue(),
              allocated: item.allocated.getValue(),
              inTransit: item.inTransit.getValue(),
              version: item.version
            }
          });

          if (result.count === 0) {
            throw new ConcurrencyException(item.sku.getValue(), item.locationId);
          }
        }

        for (const event of events) {
          await this.outboxRepository!.save(event, tx);
        }
      });
    } else {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const existing = await tx.inventoryModel.findUnique({
          where: { id: item.id }
        });

        if (!existing) {
          await tx.inventoryModel.create({
            data: {
              id: item.id,
              sku: item.sku.getValue(),
              locationId: item.locationId,
              quantity: item.quantity.getValue(),
              allocated: item.allocated.getValue(),
              inTransit: item.inTransit.getValue(),
              version: item.version
            }
          });
        } else {
          const result = await tx.inventoryModel.updateMany({
            where: {
              id: item.id,
              version: item.version - 1
            },
            data: {
              quantity: item.quantity.getValue(),
              allocated: item.allocated.getValue(),
              inTransit: item.inTransit.getValue(),
              version: item.version
            }
          });

          if (result.count === 0) {
            throw new ConcurrencyException(item.sku.getValue(), item.locationId);
          }
        }
      });

      await DomainEventDispatcher.dispatch(events);
    }

    const tenantId = tenantLocalStorage.getStore() || "tenant-1";

    // Log Stock Adjustment to Compliance Ledger
    await ComplianceLedgerService.logEvent(tenantId, "STOCK_ADJUSTED", {
      sku: item.sku.getValue(),
      locationId: item.locationId,
      quantity: item.quantity.getValue(),
      allocated: item.allocated.getValue(),
      inTransit: item.inTransit.getValue(),
      version: item.version,
      reason: "Inventory repository save operation"
    });

    WebSocketManager.broadcastToTenant(tenantId, {
      type: "stock_changed",
      sku: item.sku.getValue(),
      locationId: item.locationId,
      quantity: item.quantity.getValue(),
      allocated: item.allocated.getValue(),
      inTransit: item.inTransit.getValue(),
      version: item.version
    });

    item.clearDomainEvents();
  }

  async saveMany(items: InventoryItem[]): Promise<void> {
    if (items.length === 0) return;

    if (this.outboxRepository) {
      const existingItems = await this.prisma.inventoryModel.findMany({
        where: { id: { in: items.map(i => i.id) } }
      });
      const existingIds = new Set(existingItems.map(e => e.id));

      // Run bulk writes in parallel via Promise.all
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await Promise.all(items.map(async (item) => {
          const existing = existingIds.has(item.id);

          if (!existing) {
            await tx.inventoryModel.create({
              data: {
                id: item.id,
                sku: item.sku.getValue(),
                locationId: item.locationId,
                quantity: item.quantity.getValue(),
                allocated: item.allocated.getValue(),
                inTransit: item.inTransit.getValue(),
                version: item.version
              }
            });
          } else {
            const result = await tx.inventoryModel.updateMany({
              where: {
                id: item.id,
                version: item.version - 1
              },
              data: {
                quantity: item.quantity.getValue(),
                allocated: item.allocated.getValue(),
                inTransit: item.inTransit.getValue(),
                version: item.version
              }
            });

            if (result.count === 0) {
              throw new ConcurrencyException(item.sku.getValue(), item.locationId);
            }
          }

          const events = item.getDomainEvents();
          for (const event of events) {
            await this.outboxRepository!.save(event, tx);
          }
          item.clearDomainEvents();
        }));
      });
    } else {
      const existingItems = await this.prisma.inventoryModel.findMany({
        where: { id: { in: items.map(i => i.id) } }
      });
      const existingIds = new Set(existingItems.map(e => e.id));

      // Run bulk writes in parallel via Promise.all
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await Promise.all(items.map(async (item) => {
          const existing = existingIds.has(item.id);

          if (!existing) {
            await tx.inventoryModel.create({
              data: {
                id: item.id,
                sku: item.sku.getValue(),
                locationId: item.locationId,
                quantity: item.quantity.getValue(),
                allocated: item.allocated.getValue(),
                inTransit: item.inTransit.getValue(),
                version: item.version
              }
            });
          } else {
            const result = await tx.inventoryModel.updateMany({
              where: {
                id: item.id,
                version: item.version - 1
              },
              data: {
                quantity: item.quantity.getValue(),
                allocated: item.allocated.getValue(),
                inTransit: item.inTransit.getValue(),
                version: item.version
              }
            });

            if (result.count === 0) {
              throw new ConcurrencyException(item.sku.getValue(), item.locationId);
            }
          }
        }));
      });

      const allEvents = items.flatMap(item => {
        const events = item.getDomainEvents();
        item.clearDomainEvents();
        return events;
      });

      if (allEvents.length > 0) {
        await DomainEventDispatcher.dispatch(allEvents);
      }
    }

    const tenantId = tenantLocalStorage.getStore() || "tenant-1";
    for (const item of items) {
      await ComplianceLedgerService.logEvent(tenantId, "STOCK_ADJUSTED", {
        sku: item.sku.getValue(),
        locationId: item.locationId,
        quantity: item.quantity.getValue(),
        allocated: item.allocated.getValue(),
        inTransit: item.inTransit.getValue(),
        version: item.version,
        reason: "Inventory repository saveMany operation"
      });

      WebSocketManager.broadcastToTenant(tenantId, {
        type: "stock_changed",
        sku: item.sku.getValue(),
        locationId: item.locationId,
        quantity: item.quantity.getValue(),
        allocated: item.allocated.getValue(),
        inTransit: item.inTransit.getValue(),
        version: item.version
      });
    }
  }

  async hasAnyEntries(variantId: string, locationId: string): Promise<boolean> {
    const record = await this.prisma.inventoryModel.findUnique({
      where: {
        sku_locationId: {
          sku: variantId,
          locationId: locationId
        }
      }
    });
    return record !== null;
  }
}

