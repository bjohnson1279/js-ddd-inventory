import { ITenantConfigRepository } from "../../domain/repositories/ITenantConfigRepository";
import { TenantAccountingConfig } from "../../domain/accounting/valueObjects/TenantAccountingConfig";

export class InMemoryTenantConfigRepository implements ITenantConfigRepository {
  private configs = new Map<string, TenantAccountingConfig>();

  async findByTenantId(tenantId: string): Promise<TenantAccountingConfig | null> {
    return this.configs.get(tenantId) || null;
  }

  async save(tenantId: string, config: TenantAccountingConfig): Promise<void> {
    this.configs.set(tenantId, config);
  }
}
