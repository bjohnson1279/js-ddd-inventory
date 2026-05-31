import { ISerializedItemRepository } from "../../domain/repositories/ISerializedItemRepository";
import { SerializedItem } from "../../domain/serial/aggregates/SerializedItem";
import { SerialNumber } from "../../domain/serial/valueObjects/SerialNumber";
import { SerializedItemStatus } from "../../domain/serial/enums/SerializedItemStatus";
import { StatusTransition } from "../../domain/serial/valueObjects/StatusTransition";
import { SerialNumberNotFoundException } from "../../domain/serial/exceptions/SerialNumberNotFoundException";
import { DomainEventDispatcher } from "../../domain/events/DomainEventDispatcher";
import { prisma } from "./prisma";

export class PrismaSerializedItemRepository implements ISerializedItemRepository {
  private prisma = prisma;

  private mapToDomain(record: any): SerializedItem {
    const history = record.transitions.map(
      (t: any) =>
        new StatusTransition(
          t.fromStatus as SerializedItemStatus,
          t.toStatus as SerializedItemStatus,
          t.reason || "",
          t.actorId,
          t.referenceId,
          t.transitionedAt
        )
    );

    return new SerializedItem(
      record.id,
      record.sku,
      new SerialNumber(record.serialNumber),
      record.tenantId,
      record.locationId,
      record.status as SerializedItemStatus,
      history
    );
  }

  async findBySerial(serial: SerialNumber, tenantId: string): Promise<SerializedItem | null> {
    const record = await this.prisma.serializedItemModel.findUnique({
      where: {
        serialNumber_tenantId: {
          serialNumber: serial.value,
          tenantId: tenantId,
        },
      },
      include: {
        transitions: {
          orderBy: { transitionedAt: "asc" },
        },
      },
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findBySerialOrFail(serial: SerialNumber, tenantId: string): Promise<SerializedItem> {
    const item = await this.findBySerial(serial, tenantId);
    if (!item) {
      throw new SerialNumberNotFoundException(serial);
    }
    return item;
  }

  async findById(id: string): Promise<SerializedItem | null> {
    const record = await this.prisma.serializedItemModel.findUnique({
      where: { id },
      include: {
        transitions: {
          orderBy: { transitionedAt: "asc" },
        },
      },
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findByVariant(variantId: string, status?: SerializedItemStatus): Promise<SerializedItem[]> {
    const records = await this.prisma.serializedItemModel.findMany({
      where: {
        sku: variantId,
        ...(status ? { status } : {}),
      },
      include: {
        transitions: {
          orderBy: { transitionedAt: "asc" },
        },
      },
    });

    return records.map((r) => this.mapToDomain(r));
  }

  async isRegistered(serial: SerialNumber, tenantId: string): Promise<boolean> {
    const record = await this.prisma.serializedItemModel.findUnique({
      where: {
        serialNumber_tenantId: {
          serialNumber: serial.value,
          tenantId: tenantId,
        },
      },
    });
    return record !== null;
  }

  async countByStatus(variantId: string, status: SerializedItemStatus): Promise<number> {
    return await this.prisma.serializedItemModel.count({
      where: {
        sku: variantId,
        status,
      },
    });
  }

  async save(item: SerializedItem): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.serializedItemModel.upsert({
        where: { id: item.id },
        update: {
          serialNumber: item.serialNumber.value,
          sku: item.variantId,
          status: item.status,
          locationId: item.locationId,
          tenantId: item.tenantId,
        },
        create: {
          id: item.id,
          serialNumber: item.serialNumber.value,
          sku: item.variantId,
          status: item.status,
          locationId: item.locationId,
          tenantId: item.tenantId,
        },
      });

      await tx.statusTransitionModel.deleteMany({
        where: { serializedItemId: item.id },
      });

      if (item.history.length > 0) {
        // We insert sequentially or using createMany to keep ordering if needed, but transitionedAt is tracked.
        await tx.statusTransitionModel.createMany({
          data: item.history.map((t, idx) => ({
            id: `${item.id}-t-${idx}-${t.occurredAt.getTime()}`,
            serializedItemId: item.id,
            fromStatus: t.from,
            toStatus: t.to,
            reason: t.reason,
            transitionedAt: t.occurredAt,
            actorId: t.actor,
            referenceId: t.referenceId,
          })),
        });
      }
    });

    await DomainEventDispatcher.dispatch(item.releaseEvents());
  }
}
