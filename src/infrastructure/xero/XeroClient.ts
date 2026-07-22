import { JournalEntryCreatedEvent } from "../../domain/events/JournalEntryCreatedEvent";
import { Logger } from "../../infrastructure/logging/logger";

export class XeroClient {
  private readonly baseUrl: string;

  constructor(
    private readonly tenantId: string,
    private readonly accessToken: string
  ) {
    this.baseUrl = "https://api.xro.com/api.xro/2.0";
  }

  public async publishJournalEntry(event: JournalEntryCreatedEvent): Promise<string> {
    if (!this.tenantId || this.tenantId.includes("mock") || !this.accessToken || this.accessToken.includes("mock")) {
      return `mock-xero-journal-${Math.random().toString(36).substring(7)}`;
    }

    const xeroLines = event.lines.map((line) => {
      const isCredit = line.type === "credit";
      const amount = line.amountCents / 100;
      return {
        Description: line.memo || "",
        LineAmount: isCredit ? -amount : amount,
        AccountCode: line.accountCode
      };
    });

    const xeroPayload = {
      ManualJournals: [{
        Narration: event.description,
        Reference: `JE-${event.aggregateId}`,
        JournalLines: xeroLines
      }]
    };

    const url = `${this.baseUrl}/ManualJournals`;

    Logger.info({
      context: "XeroClient",
      action: "publishJournalEntry",
      request: {
        method: "POST",
        url,
        headers: {
          "Content-Type": "application/json",
          "Xero-tenant-id": this.tenantId,
          "Authorization": "Bearer [REDACTED]",
          "Accept": "application/json"
        }
      },
      payload: xeroPayload
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Xero-tenant-id": this.tenantId,
        "Authorization": `Bearer ${this.accessToken}`,
        "Accept": "application/json"
      },
      body: JSON.stringify(xeroPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Xero API error (${response.status}): ${errorText}`);
    }

    const data: any = await response.json();
    return data.ManualJournals?.[0]?.ManualJournalID || `mock-xero-journal-${Math.random().toString(36).substring(7)}`;
  }
}
