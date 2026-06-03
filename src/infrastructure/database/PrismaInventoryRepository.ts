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

  async findBySku(sku: SKU): Promise<InventoryItem | null> {
    const record = await this.prisma.inventoryModel.findUnique({
      where: { sku: sku.getValue() }
    });

    if (!record) return null;

    return InventoryItem.create(
      record.id,
      SKU.create(record.sku),
      Quantity.create(record.quantity)
    );
  }

  async findAll(): Promise<InventoryItem[]> {
    const records = await this.prisma.inventoryModel.findMany();
    return records.map((record: { id: string; sku: string; quantity: number }) => 
      InventoryItem.create(
        record.id,
        SKU.create(record.sku),
        Quantity.create(record.quantity)
      )
    );
  }

  async save(item: InventoryItem): Promise<void> {
    const events = item.getDomainEvents();

    if (this.outboxRepository) {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.inventoryModel.upsert({
          where: { sku: item.sku.getValue() },
          update: { quantity: item.quantity.getValue() },
          create: {
            id: item.id,
            sku: item.sku.getValue(),
            quantity: item.quantity.getValue()
          }
        });

        for (const event of events) {
          await this.outboxRepository!.save(event, tx);
        }
      });
    } else {
      await this.prisma.inventoryModel.upsert({
        where: { sku: item.sku.getValue() },
        update: { quantity: item.quantity.getValue() },
        create: {
          id: item.id,
          sku: item.sku.getValue(),
          quantity: item.quantity.getValue()
        }
      });

      await DomainEventDispatcher.dispatch(events);
    }

    item.clearDomainEvents();
  }

  async hasAnyEntries(variantId: string, locationId: string): Promise<boolean> {
    const record = await this.prisma.inventoryModel.findUnique({
      where: { sku: variantId }
    });
    return record !== null;
  }
}

