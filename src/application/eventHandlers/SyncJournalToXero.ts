import { JournalEntryCreatedEvent } from "../../domain/events/JournalEntryCreatedEvent";
import { XeroClient } from "../../infrastructure/xero/XeroClient";
import { prisma } from "../../infrastructure/database/prisma";
import crypto from "crypto";

export const syncJournalToXero = async (event: JournalEntryCreatedEvent): Promise<void> => {
  const tenantId = process.env.XERO_TENANT_ID || "mock";
  const accessToken = process.env.XERO_ACCESS_TOKEN || "mock";

  try {
    const existing = await prisma.xeroJournalMappingModel.findUnique({
      where: { journalEntryId: event.aggregateId }
    });

    if (existing) {
      console.log(`[Xero Sync] Local journal ${event.aggregateId} already synced to Xero.`);
      return;
    }

    const xeroClient = new XeroClient(tenantId, accessToken);
    const xeroId = await xeroClient.publishJournalEntry(event);

    await prisma.xeroJournalMappingModel.upsert({
      where: { journalEntryId: event.aggregateId },
      create: {
        id: crypto.randomUUID(),
        journalEntryId: event.aggregateId,
        xeroJournalId: xeroId
      },
      update: {
        xeroJournalId: xeroId
      }
    });

    console.log(`[Xero Sync] Successfully mapped local journal ${event.aggregateId} -> Xero ${xeroId}`);
  } catch (err: any) {
    console.error(`[Xero Sync] Failed for journal ${event.aggregateId}:`, err);
  }
};
