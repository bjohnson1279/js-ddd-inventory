import { AccountingMethod } from "../enums/AccountingMethod";
import { CostingMethod } from "../enums/CostingMethod";

export class TenantAccountingConfig {
  constructor(
    public readonly accountingMethod: AccountingMethod,
    public readonly costingMethod: CostingMethod,
    public readonly currencyCode: string,
    public readonly fiscalYearStart: string
  ) {
    if (
      accountingMethod === AccountingMethod.Cash &&
      costingMethod !== CostingMethod.WeightedAverageCost
    ) {
      throw new Error(
        "Cash accounting should use WeightedAverageCost as the costing method."
      );
    }
  }
}
