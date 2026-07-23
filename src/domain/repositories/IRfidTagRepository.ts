import { RfidTag } from "../rfid/valueObjects/RfidTag";

export interface IRfidTagRepository {
  findByEpc(tenantId: string, epc: string): Promise<RfidTag | null>;
  findByEpcs(tenantId: string, epcs: string[]): Promise<RfidTag[]>;
  save(tenantId: string, tag: RfidTag): Promise<void>;
  saveAll(tenantId: string, tags: RfidTag[]): Promise<void>;
}
