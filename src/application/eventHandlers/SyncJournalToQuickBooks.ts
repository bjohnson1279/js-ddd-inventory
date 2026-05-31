import { JournalEntryCreatedEvent } from "../../domain/events/JournalEntryCreatedEvent";
import { QuickBooksClient } from "../../infrastructure/quickbooks/QuickBooksClient";

const qbClient = new QuickBooksClient();

export const syncJournalToQuickBooks = async (event: JournalEntryCreatedEvent): Promise<void> => {
  await qbClient.publishJournalEntry(event);
};
