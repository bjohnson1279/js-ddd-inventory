import { InMemoryInventoryRepository } from "./src/infrastructure/database/InMemoryInventoryRepository";
import { InMemoryOutboxRepository } from "./src/infrastructure/database/InMemoryOutboxRepository";
import { InventoryItem } from "./src/domain/aggregates/InventoryItem";
import { SKU } from "./src/domain/valueObjects/SKU";
import { Quantity } from "./src/domain/valueObjects/Quantity";
import { IDomainEvent } from "./src/domain/events/IDomainEvent";

class MockEvent implements IDomainEvent {
  eventName = 'MockEvent';
  occurredOn = new Date();
  constructor(public payload: any = {}) {}
}

async function run() {
  // Add a small delay to outbox save to simulate I/O
  const outbox = new InMemoryOutboxRepository();
  const originalSave = outbox.save.bind(outbox);
  outbox.save = async (event, tx) => {
    await new Promise(resolve => setTimeout(resolve, 5));
    return originalSave(event, tx);
  };

  const repo = new InMemoryInventoryRepository(outbox);

  const items: InventoryItem[] = [];
  for (let i = 0; i < 50; i++) {
    const item = InventoryItem.create(
      `item-${i}`,
      SKU.create(`SKU-${i}`),
      "loc-1",
      Quantity.create(10),
      Quantity.create(0),
      Quantity.create(0),
      1,
      null
    );
    item.addDomainEvent(new MockEvent({ id: i, evt: 1 }));
    item.addDomainEvent(new MockEvent({ id: i, evt: 2 }));
    items.push(item);
  }

  const start = Date.now();
  await repo.saveMany(items);
  const end = Date.now();

  console.log(`Time taken: ${end - start}ms`);
}

run().catch(console.error);
