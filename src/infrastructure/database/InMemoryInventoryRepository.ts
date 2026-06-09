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

  async findBySku(sku: SKU, locationId?: string): Promise<InventoryItem | null> {
    if (locationId) {
      const item = this.items.get(`${sku.getValue()}:${locationId}`);
      return item ?? null;
    }
    // Fallback: search for this SKU under any location
    const skuStr = sku.getValue();
    for (const [key, item] of this.items.entries()) {
      if (key.startsWith(`${skuStr}:`)) {
        return item;
      }
    }
    return null;
  }

  async findBySkus(skus: SKU[], locationId: string = "default"): Promise<InventoryItem[]> {
    const results: InventoryItem[] = [];
    for (const sku of skus) {
      const item = this.items.get(`${sku.getValue()}:${locationId}`);
      if (item) {
        results.push(item);
      }
    }
    return results;
  }

  async findAll(): Promise<InventoryItem[]> {
    return Array.from(this.items.values());
  }

  async findAllByLocation(locationId: string): Promise<InventoryItem[]> {
    return Array.from(this.items.values()).filter(item => item.locationId === locationId);
  }

  async save(item: InventoryItem): Promise<void> {
    this.items.set(`${item.sku.getValue()}:${item.locationId}`, item);
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
      this.items.set(`${item.sku.getValue()}:${item.locationId}`, item);
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
    return this.items.has(`${variantId}:${locationId}`);
  }
}
