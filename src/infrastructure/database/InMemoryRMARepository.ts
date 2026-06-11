import { IRMARepository } from "../../domain/repositories/IRMARepository";
import { RMA } from "../../domain/returns/aggregates/RMA";

export class InMemoryRMARepository implements IRMARepository {
  private readonly rmas: Map<string, RMA> = new Map();

  async findById(id: string): Promise<RMA | null> {
    return this.rmas.get(id) ?? null;
  }

  async findByNumber(rmaNumber: string): Promise<RMA | null> {
    for (const rma of this.rmas.values()) {
      if (rma.rmaNumber === rmaNumber) {
        return rma;
      }
    }
    return null;
  }

  async findAll(): Promise<RMA[]> {
    return Array.from(this.rmas.values());
  }

  async save(rma: RMA): Promise<void> {
    this.rmas.set(rma.id, rma);
  }
}
