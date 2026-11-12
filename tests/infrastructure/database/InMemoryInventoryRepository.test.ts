import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { IOutboxRepository } from "../../../src/domain/repositories/IOutboxRepository";
import { IDomainEvent } from "../../../src/domain/events/IDomainEvent";
import { ConcurrencyException } from "../../../src/domain/exceptions/ConcurrencyException";

describe("InMemoryInventoryRepository", () => {
  let mockOutboxRepository: jest.Mocked<IOutboxRepository>;

  beforeEach(() => {
    mockOutboxRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      fetchPending: jest.fn().mockResolvedValue([]),
      markProcessed: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      fetchDeadLettered: jest.fn().mockResolvedValue([]),
      retryEvent: jest.fn().mockResolvedValue(undefined),
      fetchStats: jest.fn().mockResolvedValue({
        totalPending: 0,
        totalProcessed: 0,
        totalDeadLettered: 0,
        recentFailures: []
      })
    };
  });

  it("should save and retrieve an item", async () => {
    const repo = new InMemoryInventoryRepository();
    const item = InventoryItem.create(
      "item-1",
      SKU.create("SKU-100"),
      "LOC-1",
      Quantity.create(50),
      Quantity.create(10),
      Quantity.create(5),
      1
    );

    await repo.save(item);

    const found = await repo.findBySku(SKU.create("SKU-100"), "LOC-1");
    expect(found).not.toBeNull();
    expect(found?.id).toBe("item-1");
    expect(found?.quantity.getValue()).toBe(50);
    expect(found?.allocated.getValue()).toBe(10);
    expect(found?.inTransit.getValue()).toBe(5);
  });

  it("should dispatch domain events via outboxRepository.save concurrently using Promise.all", async () => {
    const repo = new InMemoryInventoryRepository(mockOutboxRepository);
    const item = InventoryItem.create(
      "item-1",
      SKU.create("SKU-100"),
      "LOC-1",
      Quantity.create(0),
      Quantity.create(0),
      Quantity.create(0),
      1
    );

    const event1: IDomainEvent = {
      eventName: "TestEvent1",
      occurredOn: new Date(),
      payload: { test: 1 }
    };
    const event2: IDomainEvent = {
      eventName: "TestEvent2",
      occurredOn: new Date(),
      payload: { test: 2 }
    };

    (item as any)._domainEvents = [event1, event2];

    await repo.save(item);

    expect(mockOutboxRepository.save).toHaveBeenCalledTimes(2);
    expect(mockOutboxRepository.save).toHaveBeenCalledWith(event1);
    expect(mockOutboxRepository.save).toHaveBeenCalledWith(event2);
    expect(item.getDomainEvents()).toHaveLength(0);
  });

  it("should throw ConcurrencyException on version mismatch in save", async () => {
    const repo = new InMemoryInventoryRepository();
    const item = InventoryItem.create(
      "item-1",
      SKU.create("SKU-100"),
      "LOC-1",
      Quantity.create(50),
      Quantity.create(0),
      Quantity.create(0),
      1
    );
    await repo.save(item);

    const invalidUpdate = InventoryItem.create(
      "item-1",
      SKU.create("SKU-100"),
      "LOC-1",
      Quantity.create(60),
      Quantity.create(0),
      Quantity.create(0),
      5 // Expected version was 2
    );

    await expect(repo.save(invalidUpdate)).rejects.toThrow(ConcurrencyException);
  });

  it("should save multiple items via saveMany and persist events", async () => {
    const repo = new InMemoryInventoryRepository(mockOutboxRepository);
    const item1 = InventoryItem.create(
      "item-1",
      SKU.create("SKU-1"),
      "LOC-1",
      Quantity.create(10),
      Quantity.create(0),
      Quantity.create(0),
      1
    );
    const item2 = InventoryItem.create(
      "item-2",
      SKU.create("SKU-2"),
      "LOC-1",
      Quantity.create(20),
      Quantity.create(0),
      Quantity.create(0),
      1
    );

    const event1: IDomainEvent = { eventName: "E1", occurredOn: new Date(), payload: {} };
    const event2: IDomainEvent = { eventName: "E2", occurredOn: new Date(), payload: {} };
    (item1 as any)._domainEvents = [event1];
    (item2 as any)._domainEvents = [event2];

    await repo.saveMany([item1, item2]);

    expect(mockOutboxRepository.save).toHaveBeenCalledTimes(2);
    expect(item1.getDomainEvents()).toHaveLength(0);
    expect(item2.getDomainEvents()).toHaveLength(0);

    const foundItems = await repo.findAll();
    expect(foundItems).toHaveLength(2);
  });

  it("should check entry existence with hasAnyEntries", async () => {
    const repo = new InMemoryInventoryRepository();
    const item = InventoryItem.create(
      "item-1",
      SKU.create("SKU-1"),
      "LOC-1",
      Quantity.create(10),
      Quantity.create(0),
      Quantity.create(0),
      1
    );
    await repo.save(item);

    expect(await repo.hasAnyEntries("SKU-1", "LOC-1")).toBe(true);
    expect(await repo.hasAnyEntries("SKU-2", "LOC-1")).toBe(false);
  });
});
