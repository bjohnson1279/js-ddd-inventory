import { IRfidTagRepository } from "../../domain/repositories/IRfidTagRepository";
import { RfidTag } from "../../domain/rfid/valueObjects/RfidTag";
import { prisma } from "./prisma";

export class PrismaRfidTagRepository implements IRfidTagRepository {
  private prisma = prisma;

  async findByEpc(tenantId: string, epc: string): Promise<RfidTag | null> {
    const record = await this.prisma.rfidTagModel.findUnique({
      where: { epc: epc.toUpperCase() },
    });

    if (!record) return null;

    return new RfidTag(
      record.epc,
      record.sku,
      record.serialNumber,
      record.status,
      record.lastSeenAt,
      record.lastLocation
    );
  }

  async findByEpcs(tenantId: string, epcs: string[]): Promise<RfidTag[]> {
    const records = await this.prisma.rfidTagModel.findMany({
      where: {
        epc: {
          in: epcs.map((e) => e.toUpperCase()),
        },
      },
    });

    return records.map(
      (r) =>
        new RfidTag(
          r.epc,
          r.sku,
          r.serialNumber,
          r.status,
          r.lastSeenAt,
          r.lastLocation
        )
    );
  }

  async save(tenantId: string, tag: RfidTag): Promise<void> {
    await this.prisma.rfidTagModel.upsert({
      where: { epc: tag.epc },
      create: {
        epc: tag.epc,
        sku: tag.sku,
        serialNumber: tag.serialNumber.value,
        status: tag.status,
        lastSeenAt: tag.lastSeenAt,
        lastLocation: tag.lastLocation,
      },
      update: {
        sku: tag.sku,
        serialNumber: tag.serialNumber.value,
        status: tag.status,
        lastSeenAt: tag.lastSeenAt,
        lastLocation: tag.lastLocation,
      },
    });
  }

  async saveAll(tenantId: string, tags: RfidTag[]): Promise<void> {
    for (const tag of tags) {
      await this.save(tenantId, tag);
    }
  }
}
