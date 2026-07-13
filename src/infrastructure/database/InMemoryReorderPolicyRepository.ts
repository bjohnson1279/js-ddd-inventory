import { IReorderPolicyRepository } from "../../domain/repositories/IReorderPolicyRepository";
import { ReorderPolicy } from "../../domain/procurement/aggregates/ReorderPolicy";
import { SKU } from "../../domain/valueObjects/SKU";

export class InMemoryReorderPolicyRepository implements IReorderPolicyRepository {
  private readonly policies: Map<string, ReorderPolicy> = new Map();

  async findBySkuAndLocation(sku: SKU, locationId: string): Promise<ReorderPolicy | null> {
    return this.policies.get(`${sku.getValue()}:${locationId}`) ?? null;
  }

  async save(policy: ReorderPolicy): Promise<void> {
    this.policies.set(`${policy.sku.getValue()}:${policy.locationId}`, policy);
  }

  async findAllByLocation(locationId: string): Promise<ReorderPolicy[]> {
    return Array.from(this.policies.values()).filter((p: any) => p.locationId === locationId);
  }

  async findAll(): Promise<ReorderPolicy[]> {
    return Array.from(this.policies.values());
  }
}
