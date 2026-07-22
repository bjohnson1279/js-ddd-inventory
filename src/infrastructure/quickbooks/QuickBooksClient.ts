import { JournalEntryCreatedEvent } from "../../domain/events/JournalEntryCreatedEvent";

export class QuickBooksClient {
  private readonly baseUrl: string;

  constructor(
    private readonly realmId: string,
    private readonly accessToken: string,
    sandboxMode: boolean = true
  ) {
    this.baseUrl = sandboxMode
      ? "https://sandbox-quickbooks.api.intuit.com/v3/company"
      : "https://quickbooks.api.intuit.com/v3/company";
  }

  public async publishJournalEntry(event: JournalEntryCreatedEvent): Promise<string> {
    if (!this.realmId || this.realmId.includes("mock") || !this.accessToken || this.accessToken.includes("mock")) {
      return `mock-qbo-journal-${Math.random().toString(36).substring(7)}`;
    }

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

    const url = `${this.baseUrl}/${this.realmId}/journalentry`;

    console.info(JSON.stringify({
      context: "QuickBooksClient",
      action: "publishJournalEntry",
      request: {
        method: "POST",
        url,
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer [REDACTED]",
          "Accept": "application/json"
        }
      },
      payload: qboPayload
    }));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.accessToken}`,
        "Accept": "application/json"
      },
      body: JSON.stringify(qboPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QuickBooks API error (${response.status}): ${errorText}`);
    }

    const data: any = await response.json();
    return data.JournalEntry?.Id || data.Id || `mock-qbo-journal-${Math.random().toString(36).substring(7)}`;
  }
}
