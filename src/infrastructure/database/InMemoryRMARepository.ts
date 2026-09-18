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

  async get(rmaNumber: string): Promise<RMA | null> {
    return this.findByNumber(rmaNumber);
  }

  async rejectItem(itemId: string, reason: string): Promise<void> {
    for (const rma of this.rmas.values()) {
      const item = rma.items.find((i) => i.id === itemId);
      if (item) {
        (item as any).status = "REJECTED";
        (item as any).rejectionReason = reason;
      }
    }
  }

  async updateMapping(id: string, warehouseId: string): Promise<void> {
    const rma = await this.findById(id);
    if (rma) {
      (rma as any).locationId = warehouseId;
    }
  }

  async processDisposition(variantId: string, dto: { itemId: string; disposition: string }): Promise<void> {
    for (const rma of this.rmas.values()) {
      const item = rma.items.find((i) => i.id === dto.itemId || i.variantId === variantId);
      if (item) {
        (item as any).disposition = dto.disposition;
      }
    }
  }

  async trackInspectionNotes(rmaNumber: string, dto: { itemId: string; notes: string }): Promise<void> {
    // In-memory record tracking
  }
}
