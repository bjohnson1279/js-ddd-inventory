import { ITenantConfigRepository } from "../../domain/repositories/ITenantConfigRepository";
import { TenantAccountingConfig } from "../../domain/accounting/valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../../domain/accounting/enums/AccountingMethod";
import { CostingMethod } from "../../domain/accounting/enums/CostingMethod";
import { prisma } from "./prisma";

export class PrismaTenantConfigRepository implements ITenantConfigRepository {
  private prisma = prisma;

  async findByTenantId(tenantId: string): Promise<TenantAccountingConfig | null> {
    const record = await this.prisma.tenantConfigModel.findUnique({
      where: { tenantId }
    });

    if (!record) return null;

    return new TenantAccountingConfig(
      record.accountingMethod as AccountingMethod,
      record.costingMethod as CostingMethod,
      record.currencyCode,
      record.fiscalYearStart
    );
  }

  async save(tenantId: string, config: TenantAccountingConfig): Promise<void> {
    await this.prisma.tenantConfigModel.upsert({
      where: { tenantId },
      update: {
        accountingMethod: config.accountingMethod,
        costingMethod: config.costingMethod,
        currencyCode: config.currencyCode,
        fiscalYearStart: config.fiscalYearStart
      },
      create: {
        tenantId,
        accountingMethod: config.accountingMethod,
        costingMethod: config.costingMethod,
        currencyCode: config.currencyCode,
        fiscalYearStart: config.fiscalYearStart
      }
    });
  }
}
