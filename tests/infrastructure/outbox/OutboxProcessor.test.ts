import { OutboxProcessor } from "../../../src/infrastructure/outbox/OutboxProcessor";
import { InMemoryOutboxRepository } from "../../../src/infrastructure/database/InMemoryOutboxRepository";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { DomainEventDispatcher } from "../../../src/domain/events/DomainEventDispatcher";
import { InMemoryMessageBroker } from "../../../src/infrastructure/messaging/InMemoryMessageBroker";

describe("Transactional Outbox Pattern", () => {
  let outboxRepo: InMemoryOutboxRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let processor: OutboxProcessor;
  let handledEvents: any[] = [];

  beforeEach(() => {
    outboxRepo = new InMemoryOutboxRepository();
    inventoryRepo = new InMemoryInventoryRepository(outboxRepo);
    processor = new OutboxProcessor(outboxRepo);
    handledEvents = [];

    // Register a mock event handler
    DomainEventDispatcher.clearHandlers();
    DomainEventDispatcher.register("StockDepletedEvent", (event) => {
      handledEvents.push(event);
    });
  });

  afterEach(() => {
    DomainEventDispatcher.clearHandlers();
  });

  it("should write events to the outbox and NOT process them immediately", async () => {
    const item = InventoryItem.create("item-1", SKU.create("SKU-TEST"), Quantity.create(1));
    
    // Trigger event (decrementing to 0 raises StockDepletedEvent)
    item.dispatchStock(Quantity.create(1));

    await inventoryRepo.save(item);

    // Verify it was written to outbox repository
    expect(outboxRepo.entries.length).toBe(1);
    expect(outboxRepo.entries[0].eventName).toBe("StockDepletedEvent");
    expect(outboxRepo.entries[0].processedAt).toBeNull();

    // Verify it was NOT immediately handled by our DomainEventDispatcher handler
    expect(handledEvents.length).toBe(0);
  });

  it("should process pending outbox events asynchronously", async () => {
    const item = InventoryItem.create("item-1", SKU.create("SKU-TEST"), Quantity.create(1));
    item.dispatchStock(Quantity.create(1));
    await inventoryRepo.save(item);

    // Process the outbox
    await processor.processPending();

    // Verify it was marked as processed
    expect(outboxRepo.entries[0].processedAt).not.toBeNull();

    // Verify the mock handler was called
    expect(handledEvents.length).toBe(1);
    expect(handledEvents[0].sku).toBe("SKU-TEST");
  });

  it("should record failures and increment attempts if handling throws an error", async () => {
    // Suppress expected console.error logs for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const item = InventoryItem.create("item-1", SKU.create("SKU-TEST"), Quantity.create(1));
    item.dispatchStock(Quantity.create(1));
    await inventoryRepo.save(item);

    // Register a failing handler
    DomainEventDispatcher.clearHandlers();
    DomainEventDispatcher.register("StockDepletedEvent", () => {
      throw new Error("Test handler failure");
    });

    // Process the outbox
    await processor.processPending();

    // Verify it is not processed, but attempts are incremented and error is logged
    expect(outboxRepo.entries[0].processedAt).toBeNull();
    expect(outboxRepo.entries[0].attempts).toBe(1);
    expect(outboxRepo.entries[0].lastError).toBe("Test handler failure");

    consoleSpy.mockRestore();
  });

  it("should publish events to the message broker when configured", async () => {
    const broker = new InMemoryMessageBroker();
    const processorWithBroker = new OutboxProcessor(outboxRepo, broker);

    const item = InventoryItem.create("item-1", SKU.create("SKU-TEST"), Quantity.create(1));
    item.dispatchStock(Quantity.create(1));
    await inventoryRepo.save(item);

    // Process the outbox using processor with broker
    await processorWithBroker.processPending();

    // Verify it was marked as processed
    expect(outboxRepo.entries[0].processedAt).not.toBeNull();

    // Verify message broker received the event
    const published = broker.getPublishedEvents();
    expect(published.length).toBe(1);
    expect(published[0].topic).toBe("StockDepletedEvent");
    expect(published[0].event.eventName).toBe("StockDepletedEvent");
    expect((published[0].event as any).sku).toBe("SKU-TEST");
  });

  it("should mark outbox event as failed if message broker throws an error", async () => {
    // Suppress console.error log
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const badBroker = {
      publish: jest.fn().mockRejectedValue(new Error("Broker failure"))
    };
    const processorWithBadBroker = new OutboxProcessor(outboxRepo, badBroker);

    const item = InventoryItem.create("item-1", SKU.create("SKU-TEST"), Quantity.create(1));
    item.dispatchStock(Quantity.create(1));
    await inventoryRepo.save(item);

    // Process the outbox
    await processorWithBadBroker.processPending();

    // Verify event is not processed, and error is captured
    expect(outboxRepo.entries[0].processedAt).toBeNull();
    expect(outboxRepo.entries[0].attempts).toBe(1);
    expect(outboxRepo.entries[0].lastError).toBe("Broker failure");

    consoleSpy.mockRestore();
  });

  it("should calculate exponential backoff and skip events whose nextAttemptAt is in the future", async () => {
    // Suppress expected console.error logs
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const item = InventoryItem.create("item-1", SKU.create("SKU-TEST"), Quantity.create(1));
    item.dispatchStock(Quantity.create(1));
    await inventoryRepo.save(item);

    // Register a handler that fails
    DomainEventDispatcher.clearHandlers();
    let callCount = 0;
    DomainEventDispatcher.register("StockDepletedEvent", () => {
      callCount++;
      throw new Error("Temporary handler failure");
    });

    // 1st run: Processes the event, fails it, sets nextAttemptAt to future
    await processor.processPending();
    expect(outboxRepo.entries[0].attempts).toBe(1);
    expect(outboxRepo.entries[0].processedAt).toBeNull();
    expect(outboxRepo.entries[0].nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 1500); // 2^1 * 1000 = 2000ms
    expect(callCount).toBe(1);

    // 2nd run immediately after: event is skipped because nextAttemptAt is in the future
    await processor.processPending();
    expect(outboxRepo.entries[0].attempts).toBe(1); // Still 1, not incremented again
    expect(callCount).toBe(1); // Handler was not invoked again

    // Manually wind nextAttemptAt to the past to simulate time passing
    outboxRepo.entries[0].nextAttemptAt = new Date(Date.now() - 1000);

    // 3rd run: Processes the event again, fails it again, sets nextAttemptAt to future
    await processor.processPending();
    expect(outboxRepo.entries[0].attempts).toBe(2);
    expect(outboxRepo.entries[0].nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 3500); // 2^2 * 1000 = 4000ms
    expect(callCount).toBe(2);

    consoleSpy.mockRestore();
  });
});
