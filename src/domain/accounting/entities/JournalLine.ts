import { AccountCode } from "../valueObjects/AccountCode";
import { DebitCredit } from "../enums/DebitCredit";

export class JournalLine {
  constructor(
    public readonly id: string,
    public readonly account: AccountCode,
    public readonly amountCents: number,
    public readonly type: DebitCredit,
    public readonly memo: string
  ) {}
}
