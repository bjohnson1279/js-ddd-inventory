import { PrismaClient } from "@prisma/client";
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { DomainEventDispatcher } from "../../domain/events/DomainEventDispatcher";

export class PrismaInventoryRepository implements IInventoryRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

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
    return records.map(record => 
      InventoryItem.create(
        record.id,
        SKU.create(record.sku),
        Quantity.create(record.quantity)
      )
    );
  }

  async save(item: InventoryItem): Promise<void> {
    await this.prisma.inventoryModel.upsert({
      where: { sku: item.sku.getValue() },
      update: { quantity: item.quantity.getValue() },
      create: {
        id: item.id,
        sku: item.sku.getValue(),
        quantity: item.quantity.getValue()
      }
    });

    await DomainEventDispatcher.dispatch(item.getDomainEvents());
    item.clearDomainEvents();
  }
}
