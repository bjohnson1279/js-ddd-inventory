const qboStore = new Map<string, any>();
const nsStore = new Map<string, any>();
const xeroStore = new Map<string, any>();

jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    quickbooksJournalMappingModel: {
      deleteMany: jest.fn(async () => { qboStore.clear(); }),
      upsert: jest.fn(async (args: any) => {
        const item = { ...args.create, ...args.update };
        qboStore.set(args.where.journalEntryId, item);
        return item;
      }),
      findUnique: jest.fn(async (args: any) => {
        return qboStore.get(args.where.journalEntryId) || null;
      }),
    },
    netsuiteJournalMappingModel: {
      deleteMany: jest.fn(async () => { nsStore.clear(); }),
      upsert: jest.fn(async (args: any) => {
        const item = { ...args.create, ...args.update };
        nsStore.set(args.where.journalEntryId, item);
        return item;
      }),
      findUnique: jest.fn(async (args: any) => {
        return nsStore.get(args.where.journalEntryId) || null;
      }),
    },
    xeroJournalMappingModel: {
      deleteMany: jest.fn(async () => { xeroStore.clear(); }),
      upsert: jest.fn(async (args: any) => {
        const item = { ...args.create, ...args.update };
        xeroStore.set(args.where.journalEntryId, item);
        return item;
      }),
      findUnique: jest.fn(async (args: any) => {
        return xeroStore.get(args.where.journalEntryId) || null;
      }),
    },
    $disconnect: jest.fn(),
  },
  pool: {
    end: jest.fn(),
  },
}));

import { JournalEntryCreatedEvent } from "../../../src/domain/events/JournalEntryCreatedEvent";
import { syncJournalToQuickBooks } from "../../../src/application/eventHandlers/SyncJournalToQuickBooks";
import { syncJournalToNetSuite } from "../../../src/application/eventHandlers/SyncJournalToNetSuite";
import { syncJournalToXero } from "../../../src/application/eventHandlers/SyncJournalToXero";

describe("Accounting Sync Mapping Integration Tests", () => {
  beforeEach(async () => {
    process.env.QUICKBOOKS_REALM_ID = "real-realm";
    process.env.QUICKBOOKS_ACCESS_TOKEN = "real-token";
    process.env.NETSUITE_ACCOUNT_ID = "real-account";
    process.env.NETSUITE_TOKEN = "real-token";
    process.env.XERO_TENANT_ID = "real-tenant";
    process.env.XERO_ACCESS_TOKEN = "real-token";

    qboStore.clear();
    nsStore.clear();
    xeroStore.clear();

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ Id: "remote-id-123", ManualJournals: [{ ManualJournalID: "xero-remote-id" }], id: "ns-remote-id" }),
      })
    ) as jest.Mock;
  });

  afterEach(async () => {
    delete process.env.QUICKBOOKS_REALM_ID;
    delete process.env.QUICKBOOKS_ACCESS_TOKEN;
    delete process.env.NETSUITE_ACCOUNT_ID;
    delete process.env.NETSUITE_TOKEN;
    delete process.env.XERO_TENANT_ID;
    delete process.env.XERO_ACCESS_TOKEN;
    jest.restoreAllMocks();
  });

  it("should sync JournalEntryCreatedEvent to NetSuite, Xero, and QuickBooks, and persist mappings", async () => {
    const event = new JournalEntryCreatedEvent(
      "journal-entry-123",
      "tenant-456",
      "Test Entry Note",
      "2026-06-27",
      [
        {
          accountCode: "1010",
          accountName: "Cash",
          amountCents: 10000,
          type: "debit",
          memo: "Debit line"
        },
        {
          accountCode: "2010",
          accountName: "Accounts Payable",
          amountCents: 10000,
          type: "credit",
          memo: "Credit line"
        }
      ]
    );

    await syncJournalToQuickBooks(event);
    await syncJournalToNetSuite(event);
    await syncJournalToXero(event);

    const { prisma } = require("../../../src/infrastructure/database/prisma");

    const qboMapping = await prisma.quickbooksJournalMappingModel.findUnique({
      where: { journalEntryId: "journal-entry-123" }
    });
    expect(qboMapping).not.toBeNull();
    expect(qboMapping?.quickbooksJournalId).toBe("remote-id-123");

    const nsMapping = await prisma.netsuiteJournalMappingModel.findUnique({
      where: { journalEntryId: "journal-entry-123" }
    });
    expect(nsMapping).not.toBeNull();
    expect(nsMapping?.netsuiteJournalId).toBe("ns-remote-id");

    const xeroMapping = await prisma.xeroJournalMappingModel.findUnique({
      where: { journalEntryId: "journal-entry-123" }
    });
    expect(xeroMapping).not.toBeNull();
    expect(xeroMapping?.xeroJournalId).toBe("xero-remote-id");
  });
});
