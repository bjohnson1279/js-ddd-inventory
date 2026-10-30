const journalStore = new Map<string, any>();
const lineStore: any[] = [];
const outboxStore: any[] = [];

jest.mock("../../../src/infrastructure/database/prisma", () => {
  const mockTx = {
    journalEntryModel: {
      upsert: jest.fn(async (args: any) => {
        const id = args.where.id;
        const existing = journalStore.get(id) || {};
        const updated = { ...existing, ...(args.create || {}), ...(args.update || {}) };
        journalStore.set(id, updated);
        return updated;
      }),
    },
    journalLineModel: {
      deleteMany: jest.fn(async (args: any) => {
        const id = args.where.journalEntryId;
        for (let i = lineStore.length - 1; i >= 0; i--) {
          if (lineStore[i].journalEntryId === id) {
            lineStore.splice(i, 1);
          }
        }
      }),
      createMany: jest.fn(async (args: any) => {
        for (const line of args.data) {
          lineStore.push({ ...line });
        }
      }),
    },
    outboxEventModel: {
      create: jest.fn(async (args: any) => {
        const event = {
          id: randomUUID(),
          attempts: 0,
          processedAt: null,
          lastError: null,
          nextAttemptAt: new Date(),
          ...args.data,
        };
        outboxStore.push(event);
        return event;
      }),
    },
  };

  return {
    prisma: {
      journalEntryModel: {
        deleteMany: jest.fn(async () => {
          journalStore.clear();
        }),
        findMany: jest.fn(async (args?: any) => {
          const results: any[] = [];
          for (const entry of journalStore.values()) {
            if (args?.where?.tenantId && entry.tenantId !== args.where.tenantId) {
              continue;
            }
            const lines = lineStore.filter(l => l.journalEntryId === entry.id);
            results.push({ ...entry, lines });
          }
          return results;
        }),
      },
      journalLineModel: {
        deleteMany: jest.fn(async () => {
          lineStore.length = 0;
        }),
      },
      outboxEventModel: {
        deleteMany: jest.fn(async () => {
          outboxStore.length = 0;
        }),
        findMany: jest.fn(async () => {
          return [...outboxStore];
        }),
      },
      $transaction: jest.fn(async (callback: any) => {
        return callback(mockTx);
      }),
      $disconnect: jest.fn(),
    },
    pool: {
      end: jest.fn(),
    },
  };
});

import { PrismaJournalRepository } from "../../../src/infrastructure/database/PrismaJournalRepository";
import { PrismaOutboxRepository } from "../../../src/infrastructure/database/PrismaOutboxRepository";
import { JournalEntry } from "../../../src/domain/accounting/aggregates/JournalEntry";
import { AccountCode } from "../../../src/domain/accounting/valueObjects/AccountCode";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";
import { DebitCredit } from "../../../src/domain/accounting/enums/DebitCredit";
import { randomUUID } from "crypto";

describe("PrismaJournalRepository Unit Tests", () => {
  let journalRepo: PrismaJournalRepository;
  let journalRepoWithOutbox: PrismaJournalRepository;
  let outboxRepo: PrismaOutboxRepository;

  beforeAll(() => {
    outboxRepo = new PrismaOutboxRepository();
    journalRepo = new PrismaJournalRepository();
    journalRepoWithOutbox = new PrismaJournalRepository(outboxRepo);
  });

  beforeEach(() => {
    journalStore.clear();
    lineStore.length = 0;
    outboxStore.length = 0;
    jest.clearAllMocks();
  });

  it("should save and retrieve a journal entry", async () => {
    const entryId = "J-ENTRY-TEST-1";
    const tenantId = "TENANT-1";
    const entry = new JournalEntry(
      entryId,
      tenantId,
      new Date(),
      "Test description",
      "REF-1",
      AccountingMethod.Accrual
    );

    entry.addLine(AccountCode.inventory(), 1000, DebitCredit.Debit, "Test debit memo");
    entry.addLine(AccountCode.accountsPayable(), 1000, DebitCredit.Credit, "Test credit memo");

    entry.assertBalanced();

    await journalRepo.save(entry);

    const allEntries = await journalRepo.findAll();
    expect(allEntries.length).toBe(1);
    expect(allEntries[0].id).toBe(entryId);
    expect(allEntries[0].tenantId).toBe(tenantId);
    expect(allEntries[0].description).toBe("Test description");
    expect(allEntries[0].referenceId).toBe("REF-1");
    expect(allEntries[0].method).toBe(AccountingMethod.Accrual);
    expect(allEntries[0].lines.length).toBe(2);

    const debitLine = allEntries[0].lines.find((l) => l.type === DebitCredit.Debit);
    expect(debitLine).toBeDefined();
    expect(debitLine?.account.code).toBe("1200");
    expect(debitLine?.amountCents).toBe(1000);
    expect(debitLine?.memo).toBe("Test debit memo");

    const entriesByTenant = await journalRepo.findAll("TENANT-1");
    expect(entriesByTenant.length).toBe(1);

    const emptyEntries = await journalRepo.findAll("TENANT-2");
    expect(emptyEntries.length).toBe(0);
  });

  it("should support updating an existing entry without duplication", async () => {
    const entryId = "J-ENTRY-TEST-2";
    const entry = new JournalEntry(
      entryId,
      "TENANT-1",
      new Date(),
      "Initial description",
      "REF-1",
      AccountingMethod.Accrual
    );
    entry.addLine(AccountCode.inventory(), 1000, DebitCredit.Debit);
    entry.addLine(AccountCode.accountsPayable(), 1000, DebitCredit.Credit);
    entry.assertBalanced();
    await journalRepo.save(entry);

    const updatedEntry = new JournalEntry(
      entryId,
      "TENANT-1",
      new Date(),
      "Updated description",
      "REF-1",
      AccountingMethod.Accrual
    );
    updatedEntry.addLine(AccountCode.inventory(), 1500, DebitCredit.Debit);
    updatedEntry.addLine(AccountCode.accountsPayable(), 1500, DebitCredit.Credit);
    updatedEntry.assertBalanced();
    await journalRepo.save(updatedEntry);

    const allEntries = await journalRepo.findAll();
    expect(allEntries.length).toBe(1);
    expect(allEntries[0].description).toBe("Updated description");
    expect(allEntries[0].lines.length).toBe(2);
    expect(allEntries[0].lines[0].amountCents).toBe(1500);
  });

  it("should push events to outbox when outboxRepository is configured", async () => {
    const entryId = "J-ENTRY-TEST-3";
    const entry = new JournalEntry(
      entryId,
      "TENANT-1",
      new Date(),
      "Outbox description",
      "REF-2",
      AccountingMethod.Accrual
    );
    entry.addLine(AccountCode.inventory(), 500, DebitCredit.Debit);
    entry.addLine(AccountCode.accountsPayable(), 500, DebitCredit.Credit);
    entry.assertBalanced();

    await journalRepoWithOutbox.save(entry);

    expect(outboxStore.length).toBe(1);
    expect(outboxStore[0].eventName).toBe("JournalEntryCreatedEvent");
    const payload = JSON.parse(outboxStore[0].payload);
    expect(payload.aggregateId).toBe(entryId);
    expect(payload.description).toBe("Outbox description");
    expect(payload.lines.length).toBe(2);
  });

  it("should save entry with empty lines if needed", async () => {
    const entryId = "J-ENTRY-TEST-4";
    const entry = new JournalEntry(
      entryId,
      "TENANT-1",
      new Date(),
      "Empty lines description",
      "REF-3",
      AccountingMethod.Accrual
    );
    await journalRepo.save(entry);
    const allEntries = await journalRepo.findAll();
    expect(allEntries.length).toBe(1);
    expect(allEntries[0].id).toBe(entryId);
    expect(allEntries[0].lines.length).toBe(0);
  });
});
