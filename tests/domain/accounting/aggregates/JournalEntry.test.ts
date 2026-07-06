import { JournalEntry } from "../../../../src/domain/accounting/aggregates/JournalEntry";
import { AccountCode } from "../../../../src/domain/accounting/valueObjects/AccountCode";
import { DebitCredit } from "../../../../src/domain/accounting/enums/DebitCredit";
import { AccountingMethod } from "../../../../src/domain/accounting/enums/AccountingMethod";

describe("JournalEntry", () => {
  describe("assertBalanced", () => {
    it("should throw an error if entry is not balanced", () => {
      const entry = new JournalEntry(
        "entry-1",
        "tenant-1",
        new Date(),
        "Test Entry",
        null,
        AccountingMethod.Accrual
      );

      entry.addLine(AccountCode.cash(), 100, DebitCredit.Debit);
      entry.addLine(AccountCode.inventory(), 50, DebitCredit.Credit);

      expect(() => entry.assertBalanced()).toThrow();
    });

    it("should not throw an error if entry is balanced", () => {
      const entry = new JournalEntry(
        "entry-2",
        "tenant-1",
        new Date(),
        "Test Entry Balanced",
        null,
        AccountingMethod.Accrual
      );

      entry.addLine(AccountCode.cash(), 100, DebitCredit.Debit);
      entry.addLine(AccountCode.inventory(), 100, DebitCredit.Credit);

      expect(() => entry.assertBalanced()).not.toThrow();
    });
  });
});
