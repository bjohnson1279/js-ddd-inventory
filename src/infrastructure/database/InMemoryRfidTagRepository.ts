import { IRfidTagRepository } from "../../domain/repositories/IRfidTagRepository";
import { RfidTag } from "../../domain/rfid/valueObjects/RfidTag";

export class InMemoryRfidTagRepository implements IRfidTagRepository {
  private tags: Map<string, RfidTag> = new Map();

  async findByEpc(tenantId: string, epc: string): Promise<RfidTag | null> {
    const key = `${tenantId}_${epc.toUpperCase()}`;
    return this.tags.get(key) || null;
  }

  async findByEpcs(tenantId: string, epcs: string[]): Promise<RfidTag[]> {
    const results: RfidTag[] = [];
    const upperEpcs = epcs.map((e) => e.toUpperCase());
    for (const [key, tag] of this.tags.entries()) {
      if (key.startsWith(`${tenantId}_`) && upperEpcs.includes(tag.epc)) {
        results.push(tag);
      }
    }
    return results;
  }

  async save(tenantId: string, tag: RfidTag): Promise<void> {
    const key = `${tenantId}_${tag.epc.toUpperCase()}`;
    this.tags.set(key, tag);
  }

  async saveAll(tenantId: string, tags: RfidTag[]): Promise<void> {
    for (const tag of tags) {
      await this.save(tenantId, tag);
    }
  }
}
