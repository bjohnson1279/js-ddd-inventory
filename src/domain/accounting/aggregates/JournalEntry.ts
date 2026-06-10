import { JournalLine } from "../entities/JournalLine";
import { AccountCode } from "../valueObjects/AccountCode";
import { DebitCredit } from "../enums/DebitCredit";
import { AccountingMethod } from "../enums/AccountingMethod";
import { randomUUID } from "crypto";

export class JournalEntry {
  private readonly _lines: JournalLine[] = [];

  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly date: Date,
    public readonly description: string,
    public readonly referenceId: string | null,
    public readonly method: AccountingMethod
  ) {}

  public addLine(
    account: AccountCode,
    amountCents: number,
    type: DebitCredit,
    memo: string = ""
  ): void {
    if (amountCents <= 0) {
      throw new Error("Journal line amount must be positive.");
    }

    const line = new JournalLine(
      randomUUID(),
      account,
      amountCents,
      type,
      memo
    );

    this._lines.push(line);
  }

  public assertBalanced(): void {
    let totalDebits = 0;
    let totalCredits = 0;

    for (const line of this._lines) {
      if (line.type === DebitCredit.Debit) {
        totalDebits += line.amountCents;
      } else {
        totalCredits += line.amountCents;
      }
    }

    if (totalDebits !== totalCredits) {
      throw new Error(
        `Debits (${totalDebits} cents) do not equal credits (${totalCredits} cents) in entry ${this.id}.`
      );
    }
  }

  public get lines(): JournalLine[] {
    return [...this._lines];
  }
}
