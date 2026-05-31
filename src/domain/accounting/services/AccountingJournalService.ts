import { IJournalRepository } from "../../repositories/IJournalRepository";
import { CostLayerService } from "./CostLayerService";
import { JournalEntry } from "../aggregates/JournalEntry";
import { TenantAccountingConfig } from "../valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../enums/AccountingMethod";
import { CostingMethod } from "../enums/CostingMethod";
import { AccountCode } from "../valueObjects/AccountCode";
import { DebitCredit } from "../enums/DebitCredit";

export class AccountingJournalService {
  constructor(
    private readonly journal: IJournalRepository,
    private readonly costLayers: CostLayerService
  ) {}

  public async onStockReceived(
    variantId: string,
    totalCostCents: number,
    purchaseOrderId: string,
    supplierName: string,
    date: Date,
    config: TenantAccountingConfig,
    tenantId: string
  ): Promise<JournalEntry | null> {
    if (config.accountingMethod === AccountingMethod.Accrual) {
      return this.createEntry(
        tenantId,
        date,
        `Inventory received — PO ${purchaseOrderId}`,
        purchaseOrderId,
        AccountingMethod.Accrual,
        [
          [AccountCode.inventory(), totalCostCents, DebitCredit.Debit, `Received from ${supplierName}`],
          [
            AccountCode.accountsPayable(),
            totalCostCents,
            DebitCredit.Credit,
            `AP — ${supplierName} — PO ${purchaseOrderId}`,
          ],
        ]
      );
    }
    return null;
  }

  public async onSupplierPaid(
    amountCents: number,
    purchaseOrderId: string,
    supplierName: string,
    date: Date,
    config: TenantAccountingConfig,
    tenantId: string
  ): Promise<JournalEntry> {
    if (config.accountingMethod === AccountingMethod.Accrual) {
      return this.createEntry(
        tenantId,
        date,
        `Supplier payment — ${supplierName}`,
        purchaseOrderId,
        AccountingMethod.Accrual,
        [
          [AccountCode.accountsPayable(), amountCents, DebitCredit.Debit, `AP cleared — ${supplierName}`],
          [AccountCode.cash(), amountCents, DebitCredit.Credit, `Payment to ${supplierName}`],
        ]
      );
    } else {
      return this.createEntry(
        tenantId,
        date,
        `Inventory purchase — ${supplierName}`,
        purchaseOrderId,
        AccountingMethod.Cash,
        [
          [
            AccountCode.inventoryExpense(),
            amountCents,
            DebitCredit.Debit,
            `Inventory purchased from ${supplierName}`,
          ],
          [AccountCode.cash(), amountCents, DebitCredit.Credit, `Payment to ${supplierName}`],
        ]
      );
    }
  }

  public async onStockSold(
    variantId: string,
    quantity: number,
    salePriceCents: number,
    paymentReceivedNow: boolean,
    customerName: string | null,
    saleId: string,
    date: Date,
    config: TenantAccountingConfig,
    tenantId: string
  ): Promise<JournalEntry | null> {
    const receivableAccount = paymentReceivedNow
      ? AccountCode.cash()
      : AccountCode.accountsReceivable();

    const receivableMemo = paymentReceivedNow
      ? "Cash received"
      : `AR — ${customerName || "Walk-in Customer"}`;

    if (config.accountingMethod === AccountingMethod.Accrual) {
      let cogsBreakdown;
      if (config.costingMethod === CostingMethod.FIFO) {
        cogsBreakdown = await this.costLayers.consumeFifoLayers(variantId, quantity);
      } else if (config.costingMethod === CostingMethod.WeightedAverageCost) {
        cogsBreakdown = await this.costLayers.calculateWeightedAverageCost(variantId, quantity);
      } else {
        throw new Error(
          "SpecificIdentification requires serial numbers. Use a dedicated path."
        );
      }

      return this.createEntry(
        tenantId,
        date,
        `Sale — ${saleId}`,
        saleId,
        AccountingMethod.Accrual,
        [
          [receivableAccount, salePriceCents, DebitCredit.Debit, receivableMemo],
          [AccountCode.salesRevenue(), salePriceCents, DebitCredit.Credit, "Sales revenue"],
          [AccountCode.costOfGoodsSold(), cogsBreakdown.totalCostCents, DebitCredit.Debit, "COGS"],
          [AccountCode.inventory(), cogsBreakdown.totalCostCents, DebitCredit.Credit, "Inventory reduction"],
        ]
      );
    } else {
      if (paymentReceivedNow) {
        return this.createEntry(
          tenantId,
          date,
          `Sale — ${saleId}`,
          saleId,
          AccountingMethod.Cash,
          [
            [AccountCode.cash(), salePriceCents, DebitCredit.Debit, "Cash received"],
            [AccountCode.salesRevenue(), salePriceCents, DebitCredit.Credit, "Sales revenue"],
          ]
        );
      }
      return null;
    }
  }

  public async onCustomerPaymentReceived(
    amountCents: number,
    invoiceId: string,
    customerName: string,
    date: Date,
    config: TenantAccountingConfig,
    tenantId: string
  ): Promise<JournalEntry | null> {
    if (config.accountingMethod === AccountingMethod.Accrual) {
      return this.createEntry(
        tenantId,
        date,
        `Customer payment — ${customerName}`,
        invoiceId,
        AccountingMethod.Accrual,
        [
          [AccountCode.cash(), amountCents, DebitCredit.Debit, "Cash received"],
          [AccountCode.accountsReceivable(), amountCents, DebitCredit.Credit, `AR cleared — ${customerName}`],
        ]
      );
    } else {
      return this.createEntry(
        tenantId,
        date,
        `Customer payment — ${customerName}`,
        invoiceId,
        AccountingMethod.Cash,
        [
          [AccountCode.cash(), amountCents, DebitCredit.Debit, "Cash received"],
          [AccountCode.salesRevenue(), amountCents, DebitCredit.Credit, "Sales revenue"],
        ]
      );
    }
  }

  private async createEntry(
    tenantId: string,
    date: Date,
    description: string,
    referenceId: string | null,
    method: AccountingMethod,
    lines: [AccountCode, number, DebitCredit, string][]
  ): Promise<JournalEntry> {
    const entry = new JournalEntry(
      Math.random().toString(36).substring(2, 11),
      tenantId,
      date,
      description,
      referenceId,
      method
    );

    for (const [account, amount, type, memo] of lines) {
      entry.addLine(account, amount, type, memo);
    }

    entry.assertBalanced();
    await this.journal.save(entry);
    return entry;
  }
}
