import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
import { SKU } from "../../domain/valueObjects/SKU";
import { DomainEventDispatcher } from "../../domain/events/DomainEventDispatcher";

export class InMemoryInventoryRepository implements IInventoryRepository {
  private readonly items: Map<string, InventoryItem> = new Map();

  async findBySku(sku: SKU): Promise<InventoryItem | null> {
    const item = this.items.get(sku.getValue());
    return item ?? null;
  }

  async findAll(): Promise<InventoryItem[]> {
    return Array.from(this.items.values());
  }

  async save(item: InventoryItem): Promise<void> {
    this.items.set(item.sku.getValue(), item);
    await DomainEventDispatcher.dispatch(item.getDomainEvents());
    item.clearDomainEvents();
  }

  async hasAnyEntries(variantId: string, locationId: string): Promise<boolean> {
    // In memory we don't track location yet, so we just check if variant exists
    return this.items.has(variantId);
  }
}
