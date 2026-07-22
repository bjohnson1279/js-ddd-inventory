import { JournalEntryCreatedEvent } from "../../domain/events/JournalEntryCreatedEvent";
import { QuickBooksClient } from "../../infrastructure/quickbooks/QuickBooksClient";
import { prisma } from "../../infrastructure/database/prisma";
import crypto from "crypto";

export const syncJournalToQuickBooks = async (event: JournalEntryCreatedEvent): Promise<void> => {
  const realmId = process.env.QUICKBOOKS_REALM_ID || "mock";
  const accessToken = process.env.QUICKBOOKS_ACCESS_TOKEN || "mock";
  const sandboxMode = process.env.QUICKBOOKS_ENVIRONMENT !== "production";

  try {
    const existing = await prisma.quickbooksJournalMappingModel.findUnique({
      where: { journalEntryId: event.aggregateId }
    });

    if (existing) {
      console.log(`[QuickBooks Sync] Local journal ${event.aggregateId} already synced to QuickBooks.`);
      return;
    }

    const qbClient = new QuickBooksClient(realmId, accessToken, sandboxMode);
    const qbId = await qbClient.publishJournalEntry(event);

    await prisma.quickbooksJournalMappingModel.upsert({
      where: { journalEntryId: event.aggregateId },
      create: {
        id: crypto.randomUUID(),
        journalEntryId: event.aggregateId,
        quickbooksJournalId: qbId
      },
      update: {
        quickbooksJournalId: qbId
      }
    });

    console.log(`[QuickBooks Sync] Successfully mapped local journal ${event.aggregateId} -> QuickBooks ${qbId}`);
  } catch (err: any) {
    console.error(`[QuickBooks Sync] Failed for journal ${event.aggregateId}:`, err);
  }
};

