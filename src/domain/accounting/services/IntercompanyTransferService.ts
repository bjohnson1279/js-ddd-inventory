import { IntercompanyTransfer } from '../aggregates/IntercompanyTransfer';
import { JournalEntry } from '../aggregates/JournalEntry';
import { AccountCode } from '../valueObjects/AccountCode';
import { DebitCredit } from '../enums/DebitCredit';
import { AccountingMethod } from '../enums/AccountingMethod';
import { v4 as uuidv4 } from 'uuid';

export class IntercompanyTransferService {
  /**
   * Executes a transfer of inventory between two legal entities within the same tenant.
   * Generates the transfer record and the required journal entries, including elimination.
   *
   * @param tenantId The tenant ID
   * @param fromEntityId The source Legal Entity ID
   * @param toEntityId The destination Legal Entity ID
   * @param sku The product SKU being transferred
   * @param quantity The amount being transferred
   * @param unitCostCents The standard cost of the item in the source entity
   * @param markupPercentage The markup percentage (e.g., 0.15 for 15%)
   * @param dutyCents Any duty/tariffs applied to the transfer
   */
  public executeTransfer(
    tenantId: string,
    fromEntityId: string,
    toEntityId: string,
    sku: string,
    quantity: number,
    unitCostCents: number,
    markupPercentage: number,
    dutyCents: number = 0
  ): { transfer: IntercompanyTransfer; standardJournal: JournalEntry; eliminationJournal: JournalEntry } {
    const totalCostCents = unitCostCents * quantity;
    const markupAmount = Math.round(totalCostCents * markupPercentage);
    const transferPriceCents = totalCostCents + markupAmount;

    const transfer = IntercompanyTransfer.initiate(
      tenantId,
      fromEntityId,
      toEntityId,
      sku,
      quantity,
      transferPriceCents,
      dutyCents
    );

    // Standard Entry (recorded at the Tenant consolidated level, or could be per entity)
    const standardJournal = new JournalEntry(
      uuidv4(),
      tenantId,
      new Date(),
      `Intercompany transfer of ${quantity}x ${sku} from ${fromEntityId} to ${toEntityId}`,
      transfer.id,
      AccountingMethod.Accrual
    );

    // Entity A (Seller)
    // Credit Inventory (COGS)
    standardJournal.addLine(AccountCode.inventory(), totalCostCents, DebitCredit.Credit, `Inventory outflow - ${fromEntityId}`);
    // Debit COGS
    standardJournal.addLine(AccountCode.intercompanyCogs(), totalCostCents, DebitCredit.Debit, `Intercompany COGS - ${fromEntityId}`);
    // Credit Revenue
    standardJournal.addLine(AccountCode.intercompanyRevenue(), transferPriceCents, DebitCredit.Credit, `Intercompany Revenue - ${fromEntityId}`);
    // Debit Accounts Receivable (from Entity B)
    standardJournal.addLine(AccountCode.accountsReceivable(), transferPriceCents, DebitCredit.Debit, `Due from ${toEntityId}`);

    // Entity B (Buyer)
    // Debit Inventory (at Transfer Price + Duties)
    const totalNewInventoryValue = transferPriceCents + dutyCents;
    standardJournal.addLine(AccountCode.inventory(), totalNewInventoryValue, DebitCredit.Debit, `Inventory inflow - ${toEntityId}`);
    // Credit Accounts Payable (to Entity A)
    standardJournal.addLine(AccountCode.accountsPayable(), transferPriceCents, DebitCredit.Credit, `Due to ${fromEntityId}`);
    // Credit Cash (assuming duty is paid in cash)
    if (dutyCents > 0) {
      standardJournal.addLine(AccountCode.cash(), dutyCents, DebitCredit.Credit, `Duty paid for transfer`);
    }

    standardJournal.assertBalanced();

    // Elimination Entry for Consolidation
    const eliminationJournal = new JournalEntry(
      uuidv4(),
      tenantId,
      new Date(),
      `Intercompany elimination for transfer ${transfer.id}`,
      transfer.id,
      AccountingMethod.Accrual
    );

    // Eliminate AR and AP
    eliminationJournal.addLine(AccountCode.accountsPayable(), transferPriceCents, DebitCredit.Debit, `Eliminate Due to ${fromEntityId}`);
    eliminationJournal.addLine(AccountCode.accountsReceivable(), transferPriceCents, DebitCredit.Credit, `Eliminate Due from ${toEntityId}`);

    // Eliminate Intercompany Revenue and COGS, difference goes to Equity Elimination (unrealized profit in inventory)
    eliminationJournal.addLine(AccountCode.intercompanyRevenue(), transferPriceCents, DebitCredit.Debit, `Eliminate IC Revenue`);
    eliminationJournal.addLine(AccountCode.intercompanyCogs(), totalCostCents, DebitCredit.Credit, `Eliminate IC COGS`);
    if (markupAmount > 0) {
      eliminationJournal.addLine(AccountCode.intercompanyElimination(), markupAmount, DebitCredit.Credit, `Eliminate unrealized markup in inventory`);
    }

    eliminationJournal.assertBalanced();

    transfer.completeWithJournal(standardJournal.id);

    return { transfer, standardJournal, eliminationJournal };
  }
}
