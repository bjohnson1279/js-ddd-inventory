import { AccountCode } from '../../../../src/domain/accounting/valueObjects/AccountCode';
import { AccountCategory } from '../../../../src/domain/accounting/enums/AccountCategory';

describe('AccountCode Value Object', () => {
  describe('static factory methods', () => {
    it('creates standard predefined asset account codes', () => {
      const cash = AccountCode.cash();
      expect(cash.code).toBe('1000');
      expect(cash.name).toBe('Cash');
      expect(cash.category).toBe(AccountCategory.Asset);

      const ar = AccountCode.accountsReceivable();
      expect(ar.code).toBe('1100');
      expect(ar.name).toBe('Accounts Receivable');
      expect(ar.category).toBe(AccountCategory.Asset);

      const inv = AccountCode.inventory();
      expect(inv.code).toBe('1200');
      expect(inv.name).toBe('Inventory');
      expect(inv.category).toBe(AccountCategory.Asset);
    });

    it('creates standard predefined liability account codes', () => {
      const ap = AccountCode.accountsPayable();
      expect(ap.code).toBe('2000');
      expect(ap.name).toBe('Accounts Payable');
      expect(ap.category).toBe(AccountCategory.Liability);
    });

    it('creates standard predefined revenue account codes', () => {
      const sales = AccountCode.salesRevenue();
      expect(sales.code).toBe('4000');
      expect(sales.name).toBe('Sales Revenue');
      expect(sales.category).toBe(AccountCategory.Revenue);

      const gain = AccountCode.inventoryAdjustmentGain();
      expect(gain.code).toBe('4100');
      expect(gain.name).toBe('Inventory Adjustment Gain');
      expect(gain.category).toBe(AccountCategory.Revenue);

      const icRevenue = AccountCode.intercompanyRevenue();
      expect(icRevenue.code).toBe('4800');
      expect(icRevenue.name).toBe('Intercompany Revenue');
      expect(icRevenue.category).toBe(AccountCategory.Revenue);
    });

    it('creates standard predefined expense account codes', () => {
      const cogs = AccountCode.costOfGoodsSold();
      expect(cogs.code).toBe('5000');
      expect(cogs.name).toBe('Cost of Goods Sold');
      expect(cogs.category).toBe(AccountCategory.Expense);

      const invExpense = AccountCode.inventoryExpense();
      expect(invExpense.code).toBe('5100');
      expect(invExpense.name).toBe('Inventory Purchases');
      expect(invExpense.category).toBe(AccountCategory.Expense);

      const shrinkage = AccountCode.inventoryShrinkageExpense();
      expect(shrinkage.code).toBe('5200');
      expect(shrinkage.name).toBe('Inventory Shrinkage Expense');
      expect(shrinkage.category).toBe(AccountCategory.Expense);

      const writeOff = AccountCode.inventoryWriteOffExpense();
      expect(writeOff.code).toBe('5300');
      expect(writeOff.name).toBe('Inventory Write-Off Expense');
      expect(writeOff.category).toBe(AccountCategory.Expense);

      const icCogs = AccountCode.intercompanyCogs();
      expect(icCogs.code).toBe('5800');
      expect(icCogs.name).toBe('Intercompany COGS');
      expect(icCogs.category).toBe(AccountCategory.Expense);
    });

    it('creates standard predefined equity account codes', () => {
      const elimination = AccountCode.intercompanyElimination();
      expect(elimination.code).toBe('9000');
      expect(elimination.name).toBe('Intercompany Elimination');
      expect(elimination.category).toBe(AccountCategory.Equity);
    });
  });

  describe('fromCode() lookup and fallback categorization', () => {
    it('returns exact predefined instances when mapped code matches', () => {
      expect(AccountCode.fromCode('1000')).toEqual(AccountCode.cash());
      expect(AccountCode.fromCode('1100')).toEqual(AccountCode.accountsReceivable());
      expect(AccountCode.fromCode('1200')).toEqual(AccountCode.inventory());
      expect(AccountCode.fromCode('2000')).toEqual(AccountCode.accountsPayable());
      expect(AccountCode.fromCode('4000')).toEqual(AccountCode.salesRevenue());
      expect(AccountCode.fromCode('4100')).toEqual(AccountCode.inventoryAdjustmentGain());
      expect(AccountCode.fromCode('4800')).toEqual(AccountCode.intercompanyRevenue());
      expect(AccountCode.fromCode('5000')).toEqual(AccountCode.costOfGoodsSold());
      expect(AccountCode.fromCode('5100')).toEqual(AccountCode.inventoryExpense());
      expect(AccountCode.fromCode('5200')).toEqual(AccountCode.inventoryShrinkageExpense());
      expect(AccountCode.fromCode('5300')).toEqual(AccountCode.inventoryWriteOffExpense());
      expect(AccountCode.fromCode('5800')).toEqual(AccountCode.intercompanyCogs());
      expect(AccountCode.fromCode('9000')).toEqual(AccountCode.intercompanyElimination());
    });

    it('infers Liability category for unknown codes starting with 2', () => {
      const acc = AccountCode.fromCode('2500');
      expect(acc.code).toBe('2500');
      expect(acc.name).toBe('Account 2500');
      expect(acc.category).toBe(AccountCategory.Liability);
    });

    it('infers Equity category for unknown codes starting with 3', () => {
      const acc = AccountCode.fromCode('3000');
      expect(acc.code).toBe('3000');
      expect(acc.name).toBe('Account 3000');
      expect(acc.category).toBe(AccountCategory.Equity);
    });

    it('infers Revenue category for unknown codes starting with 4', () => {
      const acc = AccountCode.fromCode('4999');
      expect(acc.code).toBe('4999');
      expect(acc.name).toBe('Account 4999');
      expect(acc.category).toBe(AccountCategory.Revenue);
    });

    it('infers Expense category for unknown codes starting with 5', () => {
      const acc = AccountCode.fromCode('5999');
      expect(acc.code).toBe('5999');
      expect(acc.name).toBe('Account 5999');
      expect(acc.category).toBe(AccountCategory.Expense);
    });

    it('defaults to Asset category for any other code prefixes (e.g. 1xxx, 6xxx, alphabetic, etc.)', () => {
      const acc1 = AccountCode.fromCode('1999');
      expect(acc1.code).toBe('1999');
      expect(acc1.name).toBe('Account 1999');
      expect(acc1.category).toBe(AccountCategory.Asset);

      const acc6 = AccountCode.fromCode('6000');
      expect(acc6.code).toBe('6000');
      expect(acc6.name).toBe('Account 6000');
      expect(acc6.category).toBe(AccountCategory.Asset);

      const custom = AccountCode.fromCode('CUSTOM_CODE');
      expect(custom.code).toBe('CUSTOM_CODE');
      expect(custom.name).toBe('Account CUSTOM_CODE');
      expect(custom.category).toBe(AccountCategory.Asset);
    });
  });
});
