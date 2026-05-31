import { ISerializedItemRepository } from "../../domain/repositories/ISerializedItemRepository";
import { SerializedItem } from "../../domain/serial/aggregates/SerializedItem";
import { SerialNumber } from "../../domain/serial/valueObjects/SerialNumber";
import { SerializedItemStatus } from "../../domain/serial/enums/SerializedItemStatus";
import { SerialNumberNotFoundException } from "../../domain/serial/exceptions/SerialNumberNotFoundException";

export class InMemorySerializedItemRepository implements ISerializedItemRepository {
  private readonly items: Map<string, SerializedItem> = new Map();

  async findBySerial(serial: SerialNumber, tenantId: string): Promise<SerializedItem | null> {
    for (const item of this.items.values()) {
      if (item.serialNumber.equals(serial) && item.tenantId === tenantId) {
        return item;
      }
    }
    return null;
  }

  async findBySerialOrFail(serial: SerialNumber, tenantId: string): Promise<SerializedItem> {
    const item = await this.findBySerial(serial, tenantId);
    if (!item) {
      throw new SerialNumberNotFoundException(serial);
    }
    return item;
  }

  async findById(id: string): Promise<SerializedItem | null> {
    return this.items.get(id) || null;
  }

  async findByVariant(variantId: string, status?: SerializedItemStatus): Promise<SerializedItem[]> {
    const list: SerializedItem[] = [];
    for (const item of this.items.values()) {
      if (item.variantId === variantId) {
        if (!status || item.status === status) {
          list.push(item);
        }
      }
    }
    return list;
  }

  async isRegistered(serial: SerialNumber, tenantId: string): Promise<boolean> {
    const item = await this.findBySerial(serial, tenantId);
    return item !== null;
  }

  async countByStatus(variantId: string, status: SerializedItemStatus): Promise<number> {
    let count = 0;
    for (const item of this.items.values()) {
      if (item.variantId === variantId && item.status === status) {
        count++;
      }
    }
    return count;
  }

  async save(item: SerializedItem): Promise<void> {
    this.items.set(item.id, item);
  }
}
