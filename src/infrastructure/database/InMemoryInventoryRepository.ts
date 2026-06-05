import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
import { SKU } from "../../domain/valueObjects/SKU";
import { DomainEventDispatcher } from "../../domain/events/DomainEventDispatcher";
import { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";

export class InMemoryInventoryRepository implements IInventoryRepository {
  private readonly items: Map<string, InventoryItem> = new Map();

  constructor(
    private readonly outboxRepository?: IOutboxRepository
  ) {}

  async findBySku(sku: SKU): Promise<InventoryItem | null> {
    const item = this.items.get(sku.getValue());
    return item ?? null;
  }

  async findAll(): Promise<InventoryItem[]> {
    return Array.from(this.items.values());
  }

  async save(item: InventoryItem): Promise<void> {
    this.items.set(item.sku.getValue(), item);
    const events = item.getDomainEvents();
    if (this.outboxRepository) {
      for (const event of events) {
        await this.outboxRepository.save(event);
      }
    } else {
      await DomainEventDispatcher.dispatch(events);
    }
    item.clearDomainEvents();
  }

  async saveMany(items: InventoryItem[]): Promise<void> {
    if (items.length === 0) return;

    for (const item of items) {
      this.items.set(item.sku.getValue(), item);
    }

    if (this.outboxRepository) {
      for (const item of items) {
        const events = item.getDomainEvents();
        for (const event of events) {
          await this.outboxRepository.save(event);
        }
      }
    } else {
      const allEvents = items.flatMap(item => item.getDomainEvents());
      if (allEvents.length > 0) {
        await DomainEventDispatcher.dispatch(allEvents);
      }
    }

    for (const item of items) {
      item.clearDomainEvents();
    }
  }

  async hasAnyEntries(variantId: string, locationId: string): Promise<boolean> {
    // In memory we don't track location yet, so we just check if variant exists
    return this.items.has(variantId);
  }
}
