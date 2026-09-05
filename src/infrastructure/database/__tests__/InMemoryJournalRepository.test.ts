import { InMemoryJournalRepository } from "../InMemoryJournalRepository";
import { JournalEntry } from "../../../domain/accounting/aggregates/JournalEntry";
import { IOutboxRepository } from "../../../domain/repositories/IOutboxRepository";
import { JournalEntryCreatedEvent } from "../../../domain/events/JournalEntryCreatedEvent";
import { AccountCode } from "../../../domain/accounting/valueObjects/AccountCode";
import { DebitCredit } from "../../../domain/accounting/enums/DebitCredit";
import { AccountingMethod } from "../../../domain/accounting/enums/AccountingMethod";

describe("InMemoryJournalRepository", () => {
  let mockOutbox: jest.Mocked<IOutboxRepository>;

  beforeEach(() => {
    mockOutbox = {
      save: jest.fn(),
      fetchPending: jest.fn(),
      markProcessed: jest.fn(),
      markFailed: jest.fn(),
      fetchDeadLettered: jest.fn(),
      retryEvent: jest.fn(),
      fetchStats: jest.fn(),
    };
  });

  const createValidJournalEntry = (id: string, tenantId: string = "tenant-1") => {
    const entry = new JournalEntry(
      id,
      tenantId,
      new Date("2023-01-01T00:00:00Z"),
      "Test entry",
      null,
      AccountingMethod.Accrual
    );
    entry.addLine(AccountCode.cash(), 1000, DebitCredit.Debit);
    entry.addLine(AccountCode.salesRevenue(), 1000, DebitCredit.Credit);
    return entry;
  };

  it("should save an entry without an outbox repository", async () => {
    const repo = new InMemoryJournalRepository();
    const entry = createValidJournalEntry("entry-1");

    await repo.save(entry);

    const entries = await repo.findAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toBe(entry);
  });

  it("should save an entry and dispatch an event when outbox repository is provided", async () => {
    const repo = new InMemoryJournalRepository(mockOutbox);
    const entry = createValidJournalEntry("entry-2");

    await repo.save(entry);

    const entries = await repo.findAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toBe(entry);

    expect(mockOutbox.save).toHaveBeenCalledTimes(1);
    const savedEvent = mockOutbox.save.mock.calls[0][0] as JournalEntryCreatedEvent;
    expect(savedEvent).toBeInstanceOf(JournalEntryCreatedEvent);
    expect(savedEvent.aggregateId).toBe("entry-2");
    expect(savedEvent.tenantId).toBe("tenant-1");
    expect(savedEvent.description).toBe("Test entry");
    expect(savedEvent.date).toBe("2023-01-01T00:00:00.000Z");
    expect(savedEvent.lines).toHaveLength(2);
    expect(savedEvent.lines[0].accountCode).toBe("1000");
    expect(savedEvent.lines[0].accountName).toBe("Cash");
    expect(savedEvent.lines[0].amountCents).toBe(1000);
    expect(savedEvent.lines[0].type).toBe(DebitCredit.Debit);
    expect(savedEvent.lines[0].memo).toBe("");
    expect(savedEvent.lines[1].accountCode).toBe("4000");
    expect(savedEvent.lines[1].accountName).toBe("Sales Revenue");
    expect(savedEvent.lines[1].amountCents).toBe(1000);
    expect(savedEvent.lines[1].type).toBe(DebitCredit.Credit);
    expect(savedEvent.lines[1].memo).toBe("");
  });

  it("should return all entries for a specific tenant", async () => {
    const repo = new InMemoryJournalRepository();
    const entry1 = createValidJournalEntry("entry-3", "tenant-A");
    const entry2 = createValidJournalEntry("entry-4", "tenant-B");
    const entry3 = createValidJournalEntry("entry-5", "tenant-A");

    await repo.save(entry1);
    await repo.save(entry2);
    await repo.save(entry3);

    const tenantAEntries = await repo.findAll("tenant-A");
    expect(tenantAEntries).toHaveLength(2);
    expect(tenantAEntries).toContain(entry1);
    expect(tenantAEntries).toContain(entry3);

    const tenantBEntries = await repo.findAll("tenant-B");
    expect(tenantBEntries).toHaveLength(1);
    expect(tenantBEntries).toContain(entry2);
  });

  it("should return all entries if no tenantId is provided", async () => {
    const repo = new InMemoryJournalRepository();
    const entry1 = createValidJournalEntry("entry-6", "tenant-A");
    const entry2 = createValidJournalEntry("entry-7", "tenant-B");

    await repo.save(entry1);
    await repo.save(entry2);

    const allEntries = await repo.findAll();
    expect(allEntries).toHaveLength(2);
    expect(allEntries).toContain(entry1);
    expect(allEntries).toContain(entry2);
  });
});
