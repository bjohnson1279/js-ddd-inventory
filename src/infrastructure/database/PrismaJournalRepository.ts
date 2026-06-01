import { IJournalRepository } from "../../domain/repositories/IJournalRepository";
import { JournalEntry } from "../../domain/accounting/aggregates/JournalEntry";
import { JournalLine } from "../../domain/accounting/entities/JournalLine";
import { AccountCode } from "../../domain/accounting/valueObjects/AccountCode";
import { AccountCategory } from "../../domain/accounting/enums/AccountCategory";
import { DebitCredit } from "../../domain/accounting/enums/DebitCredit";
import { AccountingMethod } from "../../domain/accounting/enums/AccountingMethod";
import { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";
import { JournalEntryCreatedEvent } from "../../domain/events/JournalEntryCreatedEvent";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export class PrismaJournalRepository implements IJournalRepository {
  private prisma = prisma;

  constructor(
    private readonly outboxRepository?: IOutboxRepository
  ) {}

  async save(entry: JournalEntry): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.journalEntryModel.upsert({
        where: { id: entry.id },
        update: {
          tenantId: entry.tenantId,
          entryDate: entry.date,
          description: entry.description,
          referenceId: entry.referenceId,
          accountingMethod: entry.method,
        },
        create: {
          id: entry.id,
          tenantId: entry.tenantId,
          entryDate: entry.date,
          description: entry.description,
          referenceId: entry.referenceId,
          accountingMethod: entry.method,
        },
      });

      // Clear existing lines to support updates (though journal entries are usually immutable, this is safe)
      await tx.journalLineModel.deleteMany({
        where: { journalEntryId: entry.id },
      });

      if (entry.lines.length > 0) {
        await tx.journalLineModel.createMany({
          data: entry.lines.map((l) => ({
            id: l.id,
            journalEntryId: entry.id,
            accountCode: l.account.code,
            accountName: l.account.name,
            accountCategory: l.account.category,
            debitOrCredit: l.type,
            amountCents: l.amountCents,
            memo: l.memo,
          })),
        });
      }

      if (this.outboxRepository) {
        const event = new JournalEntryCreatedEvent(
          entry.id,
          entry.tenantId,
          entry.description,
          entry.date.toISOString(),
          entry.lines.map((l) => ({
            accountCode: l.account.code,
            accountName: l.account.name,
            amountCents: l.amountCents,
            type: l.type,
            memo: l.memo || "",
          }))
        );
        await this.outboxRepository.save(event, tx);
      }
    });
  }

  async findAll(tenantId?: string): Promise<JournalEntry[]> {
    const where = tenantId ? { tenantId } : undefined;
    const records = await this.prisma.journalEntryModel.findMany({
      where,
      include: {
        lines: true,
      },
      orderBy: { entryDate: "asc" },
    });

    return records.map((record) => {
      const entry = new JournalEntry(
        record.id,
        record.tenantId,
        record.entryDate,
        record.description,
        record.referenceId,
        record.accountingMethod as AccountingMethod
      );

      for (const line of record.lines) {
        const accountCode = new AccountCode(
          line.accountCode,
          line.accountName,
          line.accountCategory as AccountCategory
        );

        const domainLine = new JournalLine(
          line.id,
          accountCode,
          line.amountCents,
          line.debitOrCredit as DebitCredit,
          line.memo || ""
        );

        // Directly push onto private array to preserve database line IDs and avoid re-randomization
        (entry as any)._lines.push(domainLine);
      }

      return entry;
    });
  }
}
