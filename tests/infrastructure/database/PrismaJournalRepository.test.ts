import { PrismaJournalRepository } from "../../../src/infrastructure/database/PrismaJournalRepository";
import { PrismaOutboxRepository } from "../../../src/infrastructure/database/PrismaOutboxRepository";
import { prisma as sharedPrisma, pool } from "../../../src/infrastructure/database/prisma";
import { JournalEntry } from "../../../src/domain/accounting/aggregates/JournalEntry";
import { AccountCode } from "../../../src/domain/accounting/valueObjects/AccountCode";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";
import { DebitCredit } from "../../../src/domain/accounting/enums/DebitCredit";

describe("PrismaJournalRepository Integration Tests", () => {
  let prisma = sharedPrisma;
  let journalRepo: PrismaJournalRepository;
  let journalRepoWithOutbox: PrismaJournalRepository;
  let outboxRepo: PrismaOutboxRepository;

  beforeAll(async () => {
    outboxRepo = new PrismaOutboxRepository();
    journalRepo = new PrismaJournalRepository();
    journalRepoWithOutbox = new PrismaJournalRepository(outboxRepo);
  });

  beforeEach(async () => {
    try {
      await prisma.journalLineModel.deleteMany();
      await prisma.journalEntryModel.deleteMany();
      await prisma.outboxEventModel.deleteMany();
    } catch {}
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
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

    const outboxEvents = await prisma.outboxEventModel.findMany();
    expect(outboxEvents.length).toBe(1);
    expect(outboxEvents[0].eventName).toBe("JournalEntryCreatedEvent");
    const payload = JSON.parse(outboxEvents[0].payload);
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
