import { ReorderPolicy } from "../procurement/aggregates/ReorderPolicy";
import { SKU } from "../valueObjects/SKU";

export interface IReorderPolicyRepository {
  findBySkuAndLocation(sku: SKU, locationId: string): Promise<ReorderPolicy | null>;
  save(policy: ReorderPolicy): Promise<void>;
  findAll(): Promise<ReorderPolicy[]>;
}
