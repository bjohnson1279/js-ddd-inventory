import { syncJournalToQuickBooks } from "../../../src/application/eventHandlers/SyncJournalToQuickBooks";
import { JournalEntryCreatedEvent } from "../../../src/domain/events/JournalEntryCreatedEvent";
import { prisma } from "../../../src/infrastructure/database/prisma";
import { QuickBooksClient } from "../../../src/infrastructure/quickbooks/QuickBooksClient";
import { Logger } from "../../../src/infrastructure/logging/logger";

jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    quickbooksJournalMappingModel: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock("../../../src/infrastructure/quickbooks/QuickBooksClient");
jest.mock("../../../src/infrastructure/logging/logger");

describe("SyncJournalToQuickBooks Event Handler", () => {
  const sampleEvent = new JournalEntryCreatedEvent(
    "journal-123",
    "tenant-1",
    "Test Journal",
    "2026-01-01",
    [
      {
        accountCode: "1200",
        accountName: "Inventory",
        amountCents: 10000,
        type: "debit",
        memo: "Inventory purchase",
      },
      {
        accountCode: "2000",
        accountName: "Accounts Payable",
        amountCents: 10000,
        type: "credit",
        memo: "AP balance",
      },
    ]
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle error in findUnique gracefully and proceed with QuickBooks sync", async () => {
    (prisma.quickbooksJournalMappingModel.findUnique as jest.Mock).mockRejectedValue(
      new Error("Database connection error")
    );
    (QuickBooksClient.prototype.publishJournalEntry as jest.Mock).mockResolvedValue("qb-journal-999");
    (prisma.quickbooksJournalMappingModel.upsert as jest.Mock).mockResolvedValue({});

    await syncJournalToQuickBooks(sampleEvent);

    expect(QuickBooksClient.prototype.publishJournalEntry).toHaveBeenCalledWith(sampleEvent);
    expect(prisma.quickbooksJournalMappingModel.upsert).toHaveBeenCalledWith({
      where: { journalEntryId: "journal-123" },
      create: expect.objectContaining({
        journalEntryId: "journal-123",
        quickbooksJournalId: "qb-journal-999",
      }),
      update: {
        quickbooksJournalId: "qb-journal-999",
      },
    });
    expect(Logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Successfully mapped local journal journal-123 -> QuickBooks qb-journal-999"),
      })
    );
  });

  it("should catch error silently when mapping upsert fails", async () => {
    (prisma.quickbooksJournalMappingModel.findUnique as jest.Mock).mockResolvedValue(null);
    (QuickBooksClient.prototype.publishJournalEntry as jest.Mock).mockResolvedValue("qb-journal-888");
    (prisma.quickbooksJournalMappingModel.upsert as jest.Mock).mockRejectedValue(
      new Error("Upsert constraint failure")
    );

    await syncJournalToQuickBooks(sampleEvent);

    expect(QuickBooksClient.prototype.publishJournalEntry).toHaveBeenCalledWith(sampleEvent);
    expect(prisma.quickbooksJournalMappingModel.upsert).toHaveBeenCalled();
    expect(Logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Successfully mapped local journal journal-123 -> QuickBooks qb-journal-888"),
      })
    );
  });

  it("should catch outer error when QuickBooksClient throws an error and log with Logger.error", async () => {
    (prisma.quickbooksJournalMappingModel.findUnique as jest.Mock).mockResolvedValue(null);
    const qbError = new Error("QuickBooks API Rate Limit Exceeded");
    (QuickBooksClient.prototype.publishJournalEntry as jest.Mock).mockRejectedValue(qbError);

    await syncJournalToQuickBooks(sampleEvent);

    expect(Logger.error).toHaveBeenCalledWith({
      context: "SyncJournalToQuickBooks",
      message: "[QuickBooks Sync] Failed for journal journal-123:",
      error: qbError,
    });
    expect(prisma.quickbooksJournalMappingModel.upsert).not.toHaveBeenCalled();
  });

  it("should return early without syncing if journal mapping already exists", async () => {
    (prisma.quickbooksJournalMappingModel.findUnique as jest.Mock).mockResolvedValue({
      id: "mapping-1",
      journalEntryId: "journal-123",
      quickbooksJournalId: "qb-existing-123",
    });

    await syncJournalToQuickBooks(sampleEvent);

    expect(Logger.info).toHaveBeenCalledWith({
      context: "SyncJournalToQuickBooks",
      message: "[QuickBooks Sync] Local journal journal-123 already synced to QuickBooks.",
    });
    expect(QuickBooksClient.prototype.publishJournalEntry).not.toHaveBeenCalled();
    expect(prisma.quickbooksJournalMappingModel.upsert).not.toHaveBeenCalled();
  });
});
