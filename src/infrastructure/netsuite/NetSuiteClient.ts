import * as crypto from "crypto";
import { JournalEntryCreatedEvent } from "../../domain/events/JournalEntryCreatedEvent";

export class NetSuiteClient {
  private readonly baseUrl: string;

  constructor(
    private readonly accountId: string,
    private readonly token: string
  ) {
    const accountDomain = accountId.toLowerCase().replace(/_/g, "-");
    this.baseUrl = `https://${accountDomain}.suitetalk.api.netsuite.com/services/rest/record/v1`;
  }

  public async publishJournalEntry(event: JournalEntryCreatedEvent): Promise<string> {
    if (!this.accountId || this.accountId.includes("mock") || !this.token || this.token.includes("mock")) {
      return `mock-netsuite-journal-${crypto.randomUUID()}`;
    }

    const nsLines = event.lines.map((line) => {
      const isDebit = line.type === "debit";
      const amount = line.amountCents / 100;
      const item: any = {
        account: { id: line.accountCode },
        memo: line.memo || ""
      };
      if (isDebit) {
        item.debit = amount;
      } else {
        item.credit = amount;
      }
      return item;
    });

    const nsPayload = {
      memo: event.description,
      tranId: `JE-${event.aggregateId}`,
      line: {
        items: nsLines
      }
    };

    const url = `${this.baseUrl}/journalEntry`;

    console.info(JSON.stringify({
      context: "NetSuiteClient",
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
      payload: nsPayload
    }));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.token}`,
        "Accept": "application/json"
      },
      body: JSON.stringify(nsPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NetSuite API error (${response.status}): ${errorText}`);
    }

    const data: any = await response.json();
    return data.id || `mock-netsuite-journal-${crypto.randomUUID()}`;
  }
}
