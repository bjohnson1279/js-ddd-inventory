import { InMemoryJournalRepository } from "../../../src/infrastructure/database/InMemoryJournalRepository";
import { JournalEntry } from "../../../src/domain/accounting/aggregates/JournalEntry";
import { AccountCode } from "../../../src/domain/accounting/valueObjects/AccountCode";
import { DebitCredit } from "../../../src/domain/accounting/enums/DebitCredit";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";
import { IOutboxRepository } from "../../../src/domain/repositories/IOutboxRepository";
import { IDomainEvent } from "../../../src/domain/events/IDomainEvent";
import { JournalEntryCreatedEvent } from "../../../src/domain/events/JournalEntryCreatedEvent";
import { randomUUID } from "crypto";

describe("InMemoryJournalRepository", () => {
  let repository: InMemoryJournalRepository;
  let mockOutboxRepository: jest.Mocked<IOutboxRepository>;

  beforeEach(() => {
    mockOutboxRepository = {
      save: jest.fn(),
      fetchPending: jest.fn(),
      markProcessed: jest.fn(),
      markFailed: jest.fn(),
      fetchDeadLettered: jest.fn(),
      retryEvent: jest.fn(),
      fetchStats: jest.fn(),
    };
  });

  const createValidJournalEntry = (tenantId = "tenant-1"): JournalEntry => {
    const entry = new JournalEntry(
      randomUUID(),
      tenantId,
      new Date(),
      "Test Entry",
      "ref-123",
      AccountingMethod.Accrual
    );
    entry.addLine(AccountCode.cash(), 1000, DebitCredit.Debit, "Cash in");
    entry.addLine(AccountCode.salesRevenue(), 1000, DebitCredit.Credit, "Sales");
    entry.assertBalanced(); // Ensure it's valid
    return entry;
  };

  describe("save", () => {
    it("should save a journal entry to the repository", async () => {
      repository = new InMemoryJournalRepository();
      const entry = createValidJournalEntry();

      await repository.save(entry);

      const allEntries = await repository.findAll();
      expect(allEntries).toHaveLength(1);
      expect(allEntries[0]).toBe(entry);
    });

    it("should publish a JournalEntryCreatedEvent if outboxRepository is provided", async () => {
      repository = new InMemoryJournalRepository(mockOutboxRepository);
      const entry = createValidJournalEntry();

      await repository.save(entry);

      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);

      const savedEvent = mockOutboxRepository.save.mock.calls[0][0] as JournalEntryCreatedEvent;

      expect(savedEvent).toBeInstanceOf(JournalEntryCreatedEvent);
      expect(savedEvent.eventName).toBe("JournalEntryCreatedEvent");
      expect(savedEvent.aggregateId).toBe(entry.id);
      expect(savedEvent.tenantId).toBe(entry.tenantId);
      expect(savedEvent.description).toBe(entry.description);
      expect(savedEvent.lines).toHaveLength(2);
      expect(savedEvent.lines[0].accountCode).toBe("1000"); // Cash
      expect(savedEvent.lines[1].accountCode).toBe("4000"); // Sales Revenue
    });

    it("should not publish an event if outboxRepository is not provided", async () => {
      repository = new InMemoryJournalRepository(); // No outbox
      const entry = createValidJournalEntry();

      await repository.save(entry);

      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("should return all entries when no tenantId is provided", async () => {
      repository = new InMemoryJournalRepository();

      const entry1 = createValidJournalEntry("tenant-1");
      const entry2 = createValidJournalEntry("tenant-2");
      const entry3 = createValidJournalEntry("tenant-1");

      await repository.save(entry1);
      await repository.save(entry2);
      await repository.save(entry3);

      const allEntries = await repository.findAll();

      expect(allEntries).toHaveLength(3);
      expect(allEntries).toEqual(expect.arrayContaining([entry1, entry2, entry3]));
    });

    it("should return only entries matching the given tenantId", async () => {
      repository = new InMemoryJournalRepository();

      const entry1 = createValidJournalEntry("tenant-1");
      const entry2 = createValidJournalEntry("tenant-2"); // Different tenant
      const entry3 = createValidJournalEntry("tenant-1");

      await repository.save(entry1);
      await repository.save(entry2);
      await repository.save(entry3);

      const tenant1Entries = await repository.findAll("tenant-1");

      expect(tenant1Entries).toHaveLength(2);
      expect(tenant1Entries).toEqual(expect.arrayContaining([entry1, entry3]));
      expect(tenant1Entries).not.toContain(entry2);
    });

    it("should return an empty array if no entries match the tenantId", async () => {
      repository = new InMemoryJournalRepository();

      const entry1 = createValidJournalEntry("tenant-1");
      await repository.save(entry1);

      const tenant2Entries = await repository.findAll("tenant-2");

      expect(tenant2Entries).toHaveLength(0);
    });
  });
});
