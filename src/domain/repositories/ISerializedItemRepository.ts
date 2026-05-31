import { SerializedItem } from "../serial/aggregates/SerializedItem";
import { SerialNumber } from "../serial/valueObjects/SerialNumber";
import { SerializedItemStatus } from "../serial/enums/SerializedItemStatus";

export interface ISerializedItemRepository {
  findBySerial(serial: SerialNumber, tenantId: string): Promise<SerializedItem | null>;
  findBySerialOrFail(serial: SerialNumber, tenantId: string): Promise<SerializedItem>;
  findById(id: string): Promise<SerializedItem | null>;
  findByVariant(variantId: string, status?: SerializedItemStatus): Promise<SerializedItem[]>;
  isRegistered(serial: SerialNumber, tenantId: string): Promise<boolean>;
  countByStatus(variantId: string, status: SerializedItemStatus): Promise<number>;
  save(item: SerializedItem): Promise<void>;
}
