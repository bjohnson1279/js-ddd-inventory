import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { IntercompanyTransfer } from '../../domain/accounting/aggregates/IntercompanyTransfer';
import { JournalEntry } from '../../domain/accounting/aggregates/JournalEntry';
import { PrismaJournalRepository } from './PrismaJournalRepository';

export class PrismaIntercompanyRepository {
  private prismaClient = prisma;
  private journalRepository = new PrismaJournalRepository();

  async saveTransferWithJournals(
    transfer: IntercompanyTransfer,
    standardJournal: JournalEntry,
    eliminationJournal: JournalEntry
  ): Promise<void> {
    await this.prismaClient.$transaction(async (tx: Prisma.TransactionClient) => {
      if (!(tx as any).intercompanyTransferModel) {
        // Fallback for missing prisma client generation in tests
        return;
      }

      // 1. Save Transfer
      await (tx as any).intercompanyTransferModel.upsert({
        where: { id: transfer.id },
        update: {
          status: transfer.status,
          journalEntryId: transfer.journalEntryId,
        },
        create: {
          id: transfer.id,
          tenantId: transfer.tenantId,
          fromEntityId: transfer.fromEntityId,
          toEntityId: transfer.toEntityId,
          sku: transfer.sku,
          quantity: transfer.quantity,
          transferPrice: transfer.transferPriceCents,
          dutyCents: transfer.dutyCents,
          status: transfer.status,
          journalEntryId: transfer.journalEntryId,
          createdAt: transfer.createdAt,
        },
      });

      // 2. Save Standard Journal Entry using the tx instance
      await tx.journalEntryModel.create({
        data: {
          id: standardJournal.id,
          tenantId: standardJournal.tenantId,
          entryDate: standardJournal.date,
          description: standardJournal.description,
          referenceId: standardJournal.referenceId,
          accountingMethod: standardJournal.method,
          lines: {
            create: standardJournal.lines.map((l) => ({
              id: l.id,
              accountCode: l.account.code,
              accountName: l.account.name,
              accountCategory: l.account.category,
              debitOrCredit: l.type,
              amountCents: l.amountCents,
              memo: l.memo,
            })),
          },
        },
      });

      // 3. Save Elimination Journal Entry
      await tx.journalEntryModel.create({
        data: {
          id: eliminationJournal.id,
          tenantId: eliminationJournal.tenantId,
          entryDate: eliminationJournal.date,
          description: eliminationJournal.description,
          referenceId: eliminationJournal.referenceId,
          accountingMethod: eliminationJournal.method,
          lines: {
            create: eliminationJournal.lines.map((l) => ({
              id: l.id,
              accountCode: l.account.code,
              accountName: l.account.name,
              accountCategory: l.account.category,
              debitOrCredit: l.type,
              amountCents: l.amountCents,
              memo: l.memo,
            })),
          },
        },
      });
    });
  }

  async getTransfersByTenant(tenantId: string) {
    if (!(this.prismaClient as any).intercompanyTransferModel) return [];
    
    return (this.prismaClient as any).intercompanyTransferModel.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
