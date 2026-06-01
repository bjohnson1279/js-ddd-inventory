import { JournalEntryCreatedEvent } from "../../domain/events/JournalEntryCreatedEvent";
import { QuickBooksClient } from "../../infrastructure/quickbooks/QuickBooksClient";

export const syncJournalToQuickBooks = async (event: JournalEntryCreatedEvent): Promise<void> => {
  const realmId = process.env.QUICKBOOKS_REALM_ID || "";
  const accessToken = process.env.QUICKBOOKS_ACCESS_TOKEN || "";
  const sandboxMode = process.env.QUICKBOOKS_ENVIRONMENT !== "production";

  if (!realmId || !accessToken) {
    console.warn("[QUICKBOOKS ONLINE INTEGRATION] Missing Realm ID or Access Token. Skipping sync.");
    return;
  }

  const qbClient = new QuickBooksClient(realmId, accessToken, sandboxMode);
  await qbClient.publishJournalEntry(event);
};
