import { TenantAccountingConfig } from "../accounting/valueObjects/TenantAccountingConfig";

export interface ITenantConfigRepository {
  findByTenantId(tenantId: string): Promise<TenantAccountingConfig | null>;
  save(tenantId: string, config: TenantAccountingConfig): Promise<void>;
}
