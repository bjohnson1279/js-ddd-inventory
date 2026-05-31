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
}
