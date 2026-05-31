import { OutboxProcessor } from "../../../src/infrastructure/outbox/OutboxProcessor";
import { InMemoryOutboxRepository } from "../../../src/infrastructure/database/InMemoryOutboxRepository";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { DomainEventDispatcher } from "../../../src/domain/events/DomainEventDispatcher";

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
  });
});
