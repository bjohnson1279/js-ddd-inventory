import { OutboxProcessor } from "../../../src/infrastructure/outbox/OutboxProcessor";
import { InMemoryOutboxRepository } from "../../../src/infrastructure/database/InMemoryOutboxRepository";
import { InMemoryJournalRepository } from "../../../src/infrastructure/database/InMemoryJournalRepository";
import { InMemoryCostLayerRepository } from "../../../src/infrastructure/database/InMemoryCostLayerRepository";
import { CostLayerService } from "../../../src/domain/accounting/services/CostLayerService";
import { AccountingJournalService } from "../../../src/domain/accounting/services/AccountingJournalService";
import { TenantAccountingConfig } from "../../../src/domain/accounting/valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";
import { CostingMethod } from "../../../src/domain/accounting/enums/CostingMethod";
import { DomainEventDispatcher } from "../../../src/domain/events/DomainEventDispatcher";
import { syncJournalToQuickBooks } from "../../../src/application/eventHandlers/SyncJournalToQuickBooks";

describe("QuickBooks Online Journal Sync", () => {
  let outboxRepo: InMemoryOutboxRepository;
  let journalRepo: InMemoryJournalRepository;
  let costLayerRepo: InMemoryCostLayerRepository;
  let costLayers: CostLayerService;
  let journalService: AccountingJournalService;
  let processor: OutboxProcessor;

  beforeEach(() => {
    process.env.QUICKBOOKS_REALM_ID = "test-realm-id";
    process.env.QUICKBOOKS_ACCESS_TOKEN = "test-access-token";

    outboxRepo = new InMemoryOutboxRepository();
    journalRepo = new InMemoryJournalRepository(outboxRepo);
    costLayerRepo = new InMemoryCostLayerRepository();
    costLayers = new CostLayerService(costLayerRepo);
    journalService = new AccountingJournalService(journalRepo, costLayers);
    processor = new OutboxProcessor(outboxRepo);

    DomainEventDispatcher.clearHandlers();
    DomainEventDispatcher.register("JournalEntryCreatedEvent", syncJournalToQuickBooks);

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    ) as jest.Mock;
  });

  afterEach(() => {
    DomainEventDispatcher.clearHandlers();
    jest.restoreAllMocks();
    delete process.env.QUICKBOOKS_REALM_ID;
    delete process.env.QUICKBOOKS_ACCESS_TOKEN;
  });

  it("should write JournalEntryCreatedEvent to outbox on stock received and sync to QBO", async () => {
    const config = new TenantAccountingConfig(AccountingMethod.Accrual, CostingMethod.FIFO, "USD", "01-01");
    
    // Log stock receipt (which creates a journal entry and triggers save)
    await journalService.onStockReceived(
      "VAR-TEST",
      25000, // $250.00
      "PO-ABC",
      "Supplier Corp",
      new Date(),
      config,
      "TENANT-1"
    );

    // Verify journal entry exists in repo
    const entries = await journalRepo.findAll();
    expect(entries.length).toBe(1);

    // Verify outbox entry is created
    const pending = await outboxRepo.fetchPending(10);
    expect(pending.length).toBe(1);
    expect(pending[0].eventName).toBe("JournalEntryCreatedEvent");

    // Process outbox and check QuickBooks output
    await processor.processPending();

    // Verify it was marked processed
    expect(pending[0].processedAt).not.toBeNull();

    // Verify fetch was called with correct parameters
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = (global.fetch as jest.Mock).mock.calls[0];

    expect(fetchUrl).toBe("https://sandbox-quickbooks.api.intuit.com/v3/company/test-realm-id/journalentry");
    expect(fetchOptions.method).toBe("POST");
    expect(fetchOptions.headers["Authorization"]).toBe("Bearer test-access-token");

    const body = JSON.parse(fetchOptions.body);
    expect(body.DocNumber).toMatch(/^JE-/);
    expect(body.Line[0].Amount).toBe(250);
  });
});
