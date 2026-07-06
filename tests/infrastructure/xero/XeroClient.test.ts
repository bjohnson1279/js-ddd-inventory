import { XeroClient } from "../../../src/infrastructure/xero/XeroClient";
import { JournalEntryCreatedEvent } from "../../../src/domain/events/JournalEntryCreatedEvent";

describe("XeroClient", () => {
  let originalFetch: any;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("should return mock ID if tenantId is mock", async () => {
    const client = new XeroClient("mock-tenant", "mock-token");
    const event = new JournalEntryCreatedEvent("je-123", "t-1", "Description", "2026-06-27", []);
    const result = await client.publishJournalEntry(event);
    expect(result).toContain("mock-xero-journal-");
  });

  it("should make a POST request to Xero and return manual journal ID", async () => {
    const mockResponse = {
      ManualJournals: [{ ManualJournalID: "xero-je-999" }]
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse)
    });

    const client = new XeroClient("real-tenant", "real-token");
    const event = new JournalEntryCreatedEvent("je-123", "t-1", "Opening balance", "2026-06-27", [
      { accountCode: "1200", accountName: "Inventory", amountCents: 10000, type: "debit", memo: "Debit entry" },
      { accountCode: "2000", accountName: "Accounts Payable", amountCents: 10000, type: "credit", memo: "Credit entry" }
    ]);

    const result = await client.publishJournalEntry(event);
    expect(result).toBe("xero-je-999");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.xro.com/api.xro/2.0/ManualJournals",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Xero-tenant-id": "real-tenant",
          "Authorization": "Bearer real-token",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          ManualJournals: [{
            Narration: "Opening balance",
            Reference: "JE-je-123",
            JournalLines: [
              { Description: "Debit entry", LineAmount: 100, AccountCode: "1200" },
              { Description: "Credit entry", LineAmount: -100, AccountCode: "2000" }
            ]
          }]
        })
      })
    );
  });

  it("should throw an error on bad status response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValue("Bad Request error")
    });

    const client = new XeroClient("real-tenant", "real-token");
    const event = new JournalEntryCreatedEvent("je-123", "t-1", "Description", "2026-06-27", []);

    await expect(client.publishJournalEntry(event)).rejects.toThrow("Xero API error (400): Bad Request error");
  });
});
