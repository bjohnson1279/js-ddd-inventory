import { IBarcodeRepository } from "../../domain/repositories/IBarcodeRepository";
import { VariantBarcodeSet } from "../../domain/barcode/aggregates/VariantBarcodeSet";
import { Barcode } from "../../domain/barcode/valueObjects/Barcode";
import { BarcodeSymbology } from "../../domain/barcode/enums/BarcodeSymbology";
import { BarcodeSource } from "../../domain/barcode/enums/BarcodeSource";
import { DomainEventDispatcher } from "../../domain/events/DomainEventDispatcher";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export class PrismaBarcodeRepository implements IBarcodeRepository {
  private prisma = prisma;

  async findVariantByBarcodeValue(value: string): Promise<string | null> {
    const normalized = value.trim().toUpperCase();
    const assignment = await this.prisma.barcodeAssignmentModel.findUnique({
      where: { barcodeValue: normalized },
    });

    return assignment ? assignment.variantId : null;
  }

  async findSetForVariant(variantId: string): Promise<VariantBarcodeSet> {
    const records = await this.prisma.barcodeAssignmentModel.findMany({
      where: { variantId },
    });

    const set = new VariantBarcodeSet(variantId);

    for (const record of records) {
      const barcode = new Barcode(record.symbology as BarcodeSymbology, record.barcodeValue);
      set.assign(barcode, record.source as BarcodeSource, record.isPrimary);
    }

    // Clear events caused by rebuilding the aggregate from database
    set.releaseEvents();

    return set;
  }

  async saveSet(set: VariantBarcodeSet): Promise<void> {
    const assignments = set.all();

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.barcodeAssignmentModel.deleteMany({
        where: { variantId: set.variantId },
      });

      if (assignments.length > 0) {
        await tx.barcodeAssignmentModel.createMany({
          data: assignments.map((a) => ({
            id: a.id,
            variantId: a.variantId,
            barcodeValue: a.barcode.value,
            symbology: a.barcode.symbology,
            source: a.source,
            isPrimary: a.isPrimary,
            assignedAt: a.assignedAt,
          })),
        });
      }
    });

    await DomainEventDispatcher.dispatch(set.releaseEvents());
  }
}
