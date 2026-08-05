import { IQuarantineRepository } from "../../domain/repositories/IQuarantineRepository";
import { QuarantineItem } from "../../domain/returns/aggregates/QuarantineItem";

export class InMemoryQuarantineRepository implements IQuarantineRepository {
  private readonly items: Map<string, QuarantineItem> = new Map();

  async findById(id: string): Promise<QuarantineItem | null> {
    return this.items.get(id) ?? null;
  }

  async findAll(): Promise<QuarantineItem[]> {
    return Array.from(this.items.values());
  }

  async save(item: QuarantineItem): Promise<void> {
    this.items.set(item.id, item);
  }
}
