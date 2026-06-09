import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { DomainEventDispatcher } from "../../domain/events/DomainEventDispatcher";
import { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export class PrismaInventoryRepository implements IInventoryRepository {
  private prisma = prisma;

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
      Quantity.create(record.quantity)
    );
  }

  async findBySkus(skus: SKU[], locationId: string = "default"): Promise<InventoryItem[]> {
    const records = await this.prisma.inventoryModel.findMany({
      where: {
        sku: { in: skus.map(s => s.getValue()) },
        locationId
      }
    });

    return records.map((record: { id: string; sku: string; locationId: string; quantity: number }) =>
      InventoryItem.create(
        record.id,
        SKU.create(record.sku),
        record.locationId,
        Quantity.create(record.quantity)
      )
    );
  }

  async findAll(): Promise<InventoryItem[]> {
    const records = await this.prisma.inventoryModel.findMany();
    return records.map((record: { id: string; sku: string; locationId: string; quantity: number }) => 
      InventoryItem.create(
        record.id,
        SKU.create(record.sku),
        record.locationId,
        Quantity.create(record.quantity)
      )
    );
  }

  async findAllByLocation(locationId: string): Promise<InventoryItem[]> {
    const records = await this.prisma.inventoryModel.findMany({
      where: { locationId }
    });
    return records.map((record: { id: string; sku: string; locationId: string; quantity: number }) => 
      InventoryItem.create(
        record.id,
        SKU.create(record.sku),
        record.locationId,
        Quantity.create(record.quantity)
      )
    );
  }

  async save(item: InventoryItem): Promise<void> {
    const events = item.getDomainEvents();

    if (this.outboxRepository) {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.inventoryModel.upsert({
          where: {
            sku_locationId: {
              sku: item.sku.getValue(),
              locationId: item.locationId
            }
          },
          update: { quantity: item.quantity.getValue() },
          create: {
            id: item.id,
            sku: item.sku.getValue(),
            locationId: item.locationId,
            quantity: item.quantity.getValue()
          }
        });

        for (const event of events) {
          await this.outboxRepository!.save(event, tx);
        }
      });
    } else {
      await this.prisma.inventoryModel.upsert({
        where: {
          sku_locationId: {
            sku: item.sku.getValue(),
            locationId: item.locationId
          }
        },
        update: { quantity: item.quantity.getValue() },
        create: {
          id: item.id,
          sku: item.sku.getValue(),
          locationId: item.locationId,
          quantity: item.quantity.getValue()
        }
      });

      await DomainEventDispatcher.dispatch(events);
    }

    item.clearDomainEvents();
  }

  async saveMany(items: InventoryItem[]): Promise<void> {
    if (items.length === 0) return;

    if (this.outboxRepository) {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const operations = items.map(item => tx.inventoryModel.upsert({
          where: {
            sku_locationId: {
              sku: item.sku.getValue(),
              locationId: item.locationId
            }
          },
          update: { quantity: item.quantity.getValue() },
          create: {
            id: item.id,
            sku: item.sku.getValue(),
            locationId: item.locationId,
            quantity: item.quantity.getValue()
          }
        }));
        await Promise.all(operations);

        for (const item of items) {
          const events = item.getDomainEvents();
          for (const event of events) {
            await this.outboxRepository!.save(event, tx);
          }
          item.clearDomainEvents();
        }
      });
    } else {
      await this.prisma.$transaction(
        items.map(item => this.prisma.inventoryModel.upsert({
          where: {
            sku_locationId: {
              sku: item.sku.getValue(),
              locationId: item.locationId
            }
          },
          update: { quantity: item.quantity.getValue() },
          create: {
            id: item.id,
            sku: item.sku.getValue(),
            locationId: item.locationId,
            quantity: item.quantity.getValue()
          }
        }))
      );

      const allEvents = items.flatMap(item => {
        const events = item.getDomainEvents();
        item.clearDomainEvents();
        return events;
      });

      if (allEvents.length > 0) {
        await DomainEventDispatcher.dispatch(allEvents);
      }
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

