import { IJournalRepository } from "../../repositories/IJournalRepository";
import { CostLayerService } from "./CostLayerService";
import { JournalEntry } from "../aggregates/JournalEntry";
import { TenantAccountingConfig } from "../valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../enums/AccountingMethod";
import { CostingMethod } from "../enums/CostingMethod";
import { AccountCode } from "../valueObjects/AccountCode";
import { DebitCredit } from "../enums/DebitCredit";
import { randomUUID } from "node:crypto";

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

  public async onStockReturned(
    variantId: string,
    totalCostCents: number,
    referenceId: string,
    date: Date,
    config: TenantAccountingConfig,
    tenantId: string
  ): Promise<JournalEntry | null> {
    if (config.accountingMethod === AccountingMethod.Accrual) {
      return this.createEntry(
        tenantId,
        date,
        `Inventory return receipt — variant ${variantId} — reference ${referenceId}`,
        referenceId,
        AccountingMethod.Accrual,
        [
          [AccountCode.inventory(), totalCostCents, DebitCredit.Debit, `Returned stock`],
          [AccountCode.costOfGoodsSold(), totalCostCents, DebitCredit.Credit, `COGS reversal`],
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

  public async onInventoryAuditReconciliation(
    auditId: string,
    variantId: string,
    discrepancy: number,
    totalCostCents: number,
    date: Date,
    config: TenantAccountingConfig,
    tenantId: string
  ): Promise<JournalEntry | null> {
    if (config.accountingMethod === AccountingMethod.Accrual) {
      if (discrepancy < 0) {
        return this.createEntry(
          tenantId,
          date,
          `Inventory Shrinkage — Audit ${auditId} — Item ${variantId}`,
          auditId,
          AccountingMethod.Accrual,
          [
            [
              AccountCode.inventoryShrinkageExpense(),
              totalCostCents,
              DebitCredit.Debit,
              `Shrinkage of ${Math.abs(discrepancy)} units`
            ],
            [
              AccountCode.inventory(),
              totalCostCents,
              DebitCredit.Credit,
              `Inventory reduction`
            ]
          ]
        );
      } else if (discrepancy > 0) {
        return this.createEntry(
          tenantId,
          date,
          `Inventory Gain — Audit ${auditId} — Item ${variantId}`,
          auditId,
          AccountingMethod.Accrual,
          [
            [
              AccountCode.inventory(),
              totalCostCents,
              DebitCredit.Debit,
              `Gain of ${discrepancy} units`
            ],
            [
              AccountCode.inventoryAdjustmentGain(),
              totalCostCents,
              DebitCredit.Credit,
              `Adjustment gain`
            ]
          ]
        );
      }
    }
    return null;
  }

  public async onInventoryWriteOff(
    referenceId: string,
    totalCostCents: number,
    date: Date,
    config: TenantAccountingConfig,
    tenantId: string
  ): Promise<JournalEntry | null> {
    if (config.accountingMethod === AccountingMethod.Accrual) {
      return this.createEntry(
        tenantId,
        date,
        `Inventory Write-Off — Ref ${referenceId}`,
        referenceId,
        AccountingMethod.Accrual,
        [
          [
            AccountCode.inventoryWriteOffExpense(),
            totalCostCents,
            DebitCredit.Debit,
            `Inventory write-off`
          ],
          [
            AccountCode.inventory(),
            totalCostCents,
            DebitCredit.Credit,
            `Inventory reduction`
          ]
        ]
      );
    }
    return null;
  }

  public async onReturnToVendor(
    referenceId: string,
    totalCostCents: number,
    date: Date,
    config: TenantAccountingConfig,
    tenantId: string
  ): Promise<JournalEntry | null> {
    if (config.accountingMethod === AccountingMethod.Accrual) {
      return this.createEntry(
        tenantId,
        date,
        `Return to Vendor — Ref ${referenceId}`,
        referenceId,
        AccountingMethod.Accrual,
        [
          [
            AccountCode.accountsPayable(),
            totalCostCents,
            DebitCredit.Debit,
            `AP cleared — return to vendor`
          ],
          [
            AccountCode.inventory(),
            totalCostCents,
            DebitCredit.Credit,
            `Inventory reduction`
          ]
        ]
      );
    }
    return null;
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
      randomUUID(),
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
