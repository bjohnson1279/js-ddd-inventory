import { AccountCategory } from "../enums/AccountCategory";

export class AccountCode {
  constructor(
    public readonly code: string,
    public readonly name: string,
    public readonly category: AccountCategory
  ) {}

  public static cash(): AccountCode {
    return new AccountCode("1000", "Cash", AccountCategory.Asset);
  }

  public static accountsReceivable(): AccountCode {
    return new AccountCode("1100", "Accounts Receivable", AccountCategory.Asset);
  }

  public static inventory(): AccountCode {
    return new AccountCode("1200", "Inventory", AccountCategory.Asset);
  }

  public static accountsPayable(): AccountCode {
    return new AccountCode("2000", "Accounts Payable", AccountCategory.Liability);
  }

  public static salesRevenue(): AccountCode {
    return new AccountCode("4000", "Sales Revenue", AccountCategory.Revenue);
  }

  public static costOfGoodsSold(): AccountCode {
    return new AccountCode("5000", "Cost of Goods Sold", AccountCategory.Expense);
  }

  public static inventoryExpense(): AccountCode {
    return new AccountCode("5100", "Inventory Purchases", AccountCategory.Expense);
  }

  public static inventoryShrinkageExpense(): AccountCode {
    return new AccountCode("5200", "Inventory Shrinkage Expense", AccountCategory.Expense);
  }

  public static inventoryAdjustmentGain(): AccountCode {
    return new AccountCode("4100", "Inventory Adjustment Gain", AccountCategory.Revenue);
  }

  public static inventoryWriteOffExpense(): AccountCode {
    return new AccountCode("5300", "Inventory Write-Off Expense", AccountCategory.Expense);
  }

  public static fromCode(code: string): AccountCode {
    switch (code) {
      case "1000": return AccountCode.cash();
      case "1100": return AccountCode.accountsReceivable();
      case "1200": return AccountCode.inventory();
      case "2000": return AccountCode.accountsPayable();
      case "4000": return AccountCode.salesRevenue();
      case "5000": return AccountCode.costOfGoodsSold();
      case "5100": return AccountCode.inventoryExpense();
      case "5200": return AccountCode.inventoryShrinkageExpense();
      case "4100": return AccountCode.inventoryAdjustmentGain();
      case "5300": return AccountCode.inventoryWriteOffExpense();
      default: {
        const category = code.startsWith("2") ? AccountCategory.Liability
                       : code.startsWith("3") ? AccountCategory.Equity
                       : code.startsWith("4") ? AccountCategory.Revenue
                       : code.startsWith("5") ? AccountCategory.Expense
                       : AccountCategory.Asset;
        return new AccountCode(code, `Account ${code}`, category);
      }
    }
  }
}
