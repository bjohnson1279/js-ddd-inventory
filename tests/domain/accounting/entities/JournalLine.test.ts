import { JournalLine } from "../../../../src/domain/accounting/entities/JournalLine";
import { AccountCode } from "../../../../src/domain/accounting/valueObjects/AccountCode";
import { DebitCredit } from "../../../../src/domain/accounting/enums/DebitCredit";

describe("JournalLine Entity", () => {
  it("should create a JournalLine with valid properties", () => {
    const id = "jl-123";
    const account = AccountCode.cash();
    const amountCents = 15000;
    const type = DebitCredit.Debit;
    const memo = "Test journal line";

    const journalLine = new JournalLine(id, account, amountCents, type, memo);

    expect(journalLine.id).toBe(id);
    expect(journalLine.account).toBe(account);
    expect(journalLine.amountCents).toBe(amountCents);
    expect(journalLine.type).toBe(type);
    expect(journalLine.memo).toBe(memo);
  });

  it("should handle credit type as well", () => {
    const id = "jl-456";
    const account = AccountCode.salesRevenue();
    const amountCents = 5000;
    const type = DebitCredit.Credit;
    const memo = "Credit journal line";

    const journalLine = new JournalLine(id, account, amountCents, type, memo);

    expect(journalLine.id).toBe(id);
    expect(journalLine.account).toBe(account);
    expect(journalLine.amountCents).toBe(amountCents);
    expect(journalLine.type).toBe(type);
    expect(journalLine.memo).toBe(memo);
  });

  it("should handle empty memo", () => {
    const id = "jl-789";
    const account = AccountCode.accountsPayable();
    const amountCents = 1000;
    const type = DebitCredit.Credit;
    const memo = "";

    const journalLine = new JournalLine(id, account, amountCents, type, memo);

    expect(journalLine.id).toBe(id);
    expect(journalLine.account).toBe(account);
    expect(journalLine.amountCents).toBe(amountCents);
    expect(journalLine.type).toBe(type);
    expect(journalLine.memo).toBe(memo);
  });

  it("should handle zero amount", () => {
    const id = "jl-000";
    const account = AccountCode.inventory();
    const amountCents = 0;
    const type = DebitCredit.Debit;
    const memo = "Zero amount";

    const journalLine = new JournalLine(id, account, amountCents, type, memo);

    expect(journalLine.id).toBe(id);
    expect(journalLine.account).toBe(account);
    expect(journalLine.amountCents).toBe(amountCents);
    expect(journalLine.type).toBe(type);
    expect(journalLine.memo).toBe(memo);
  });

  it("should handle null/undefined properties bypassed via any", () => {
    const id = null as any;
    const account = undefined as any;
    const amountCents = null as any;
    const type = undefined as any;
    const memo = null as any;

    const journalLine = new JournalLine(id, account, amountCents, type, memo);

    expect(journalLine.id).toBeNull();
    expect(journalLine.account).toBeUndefined();
    expect(journalLine.amountCents).toBeNull();
    expect(journalLine.type).toBeUndefined();
    expect(journalLine.memo).toBeNull();
  });

  it("should handle extreme input lengths for memo", () => {
    const id = "jl-ext";
    const account = AccountCode.cash();
    const amountCents = 150;
    const type = DebitCredit.Debit;
    const memo = "A".repeat(10000); // 10,000 characters long

    const journalLine = new JournalLine(id, account, amountCents, type, memo);

    expect(journalLine.memo).toBe(memo);
    expect(journalLine.memo.length).toBe(10000);
  });
});
