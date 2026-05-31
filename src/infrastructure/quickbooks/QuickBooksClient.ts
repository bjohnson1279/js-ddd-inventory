import { JournalEntryCreatedEvent } from "../../domain/events/JournalEntryCreatedEvent";

export class QuickBooksClient {
  constructor(
    private readonly sandboxMode: boolean = true
  ) {}

  public async publishJournalEntry(event: JournalEntryCreatedEvent): Promise<void> {
    // Map lines to QuickBooks API Schema
    const qboLines = event.lines.map((line) => {
      const postingType = line.type === "debit" ? "Debit" : "Credit";
      return {
        Description: line.memo || event.description,
        Amount: line.amountCents / 100, // QBO expects decimal dollars
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: postingType,
          AccountRef: {
            value: line.accountCode,
            name: line.accountName
          }
        }
      };
    });

    const qboPayload = {
      DocNumber: `JE-${event.aggregateId}`,
      TxnDate: event.date.split("T")[0],
      PrivateNote: event.description,
      Line: qboLines,
      LineInfo: {
        TenantId: event.tenantId
      }
    };

    console.log("\n[QUICKBOOKS ONLINE INTEGRATION] Syncing transaction outbox event to QBO API...");
    console.log(`[QUICKBOOKS ONLINE INTEGRATION] URL: https://sandbox-quickbooks.api.intuit.com/v3/company/sandbox_co/journalentry`);
    console.log(`[QUICKBOOKS ONLINE INTEGRATION] Payload:\n${JSON.stringify(qboPayload, null, 2)}\n`);

    // In a real production setup, we would execute:
    // await fetch("https://quickbooks.api.intuit.com/v3/company/...", { method: "POST", body: JSON.stringify(qboPayload), ... })
  }
}
