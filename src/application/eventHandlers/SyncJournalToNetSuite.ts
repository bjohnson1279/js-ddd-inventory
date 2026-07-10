import { JournalEntryCreatedEvent } from "../../domain/events/JournalEntryCreatedEvent";
import { NetSuiteClient } from "../../infrastructure/netsuite/NetSuiteClient";
import { prisma } from "../../infrastructure/database/prisma";
import crypto from "crypto";

export const syncJournalToNetSuite = async (event: JournalEntryCreatedEvent): Promise<void> => {
  const accountId = process.env.NETSUITE_ACCOUNT_ID || "mock";
  const token = process.env.NETSUITE_TOKEN || "mock";

  try {
    const existing = await prisma.netsuiteJournalMappingModel.findUnique({
      where: { journalEntryId: event.aggregateId }
    });

    if (existing) {
      console.info(JSON.stringify({
        context: "NetSuite Sync",
        message: `Local journal ${event.aggregateId} already synced to NetSuite.`,
        journalEntryId: event.aggregateId
      }));

      return;
    }

    const nsClient = new NetSuiteClient(accountId, token);
    const nsId = await nsClient.publishJournalEntry(event);

    await prisma.netsuiteJournalMappingModel.upsert({
      where: { journalEntryId: event.aggregateId },
      create: {
        id: crypto.randomUUID(),
        journalEntryId: event.aggregateId,
        netsuiteJournalId: nsId
      },
      update: {
        netsuiteJournalId: nsId
      }
    });

    console.info(JSON.stringify({
      context: "NetSuite Sync",
      message: `Successfully mapped local journal ${event.aggregateId} -> NetSuite ${nsId}`,
      journalEntryId: event.aggregateId,
      nsId
    }));
  } catch (err: any) {
    console.error(JSON.stringify({
      context: "NetSuite Sync",
      message: `Failed for journal ${event.aggregateId}`,
      journalEntryId: event.aggregateId,
      error: err instanceof Error ? err.stack || err.message : err
    }));

  }
};
