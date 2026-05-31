import { TenantAccountingConfig } from "../../../src/domain/accounting/valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";
import { CostingMethod } from "../../../src/domain/accounting/enums/CostingMethod";
import { JournalEntry } from "../../../src/domain/accounting/aggregates/JournalEntry";
import { DebitCredit } from "../../../src/domain/accounting/enums/DebitCredit";
import { AccountCode } from "../../../src/domain/accounting/valueObjects/AccountCode";
import { AccountingJournalService } from "../../../src/domain/accounting/services/AccountingJournalService";
import { CostLayerService } from "../../../src/domain/accounting/services/CostLayerService";
import { InMemoryJournalRepository } from "../../../src/infrastructure/database/InMemoryJournalRepository";
import { InMemoryCostLayerRepository } from "../../../src/infrastructure/database/InMemoryCostLayerRepository";
import { InventoryCostLayer } from "../../../src/domain/accounting/entities/InventoryCostLayer";

describe("Double-Entry Bookkeeping (Accrual vs Cash)", () => {
  let journalRepo: InMemoryJournalRepository;
  let layersRepo: InMemoryCostLayerRepository;
  let costLayers: CostLayerService;
  let journalService: AccountingJournalService;

  beforeEach(() => {
    journalRepo = new InMemoryJournalRepository();
    layersRepo = new InMemoryCostLayerRepository();
    costLayers = new CostLayerService(layersRepo);
    journalService = new AccountingJournalService(journalRepo, costLayers);
  });

  describe("Configuration & Invariants", () => {
    it("should prevent cash accounting configurations from using FIFO/LIFO costing", () => {
      expect(() => {
        new TenantAccountingConfig(AccountingMethod.Cash, CostingMethod.FIFO, "USD", "01-01");
      }).toThrow(/WeightedAverageCost/i);
    });

    it("should throw error if JournalEntry does not balance", () => {
      const entry = new JournalEntry("JE-1", "TEN-1", new Date(), "Draft", null, AccountingMethod.Accrual);
      entry.addLine(AccountCode.cash(), 100, DebitCredit.Debit);
      entry.addLine(AccountCode.inventory(), 50, DebitCredit.Credit);

      expect(() => entry.assertBalanced()).toThrow(/do not equal credits/i);
    });
  });

  describe("Accrual Bookkeeping Flow", () => {
    const config = new TenantAccountingConfig(AccountingMethod.Accrual, CostingMethod.FIFO, "USD", "01-01");

    it("should record Inventory asset and Accounts Payable upon stock receipt", async () => {
      const entry = await journalService.onStockReceived(
        "VAR-A",
        5000,
        "PO-100",
        "Supplier Inc",
        new Date(),
        config,
        "TEN-1"
      );

      expect(entry).not.toBeNull();
      const lines = entry!.lines;
      expect(lines.length).toBe(2);

      expect(lines[0].account.code).toBe("1200");
      expect(lines[0].type).toBe(DebitCredit.Debit);
      expect(lines[0].amountCents).toBe(5000);

      expect(lines[1].account.code).toBe("2000");
      expect(lines[1].type).toBe(DebitCredit.Credit);
      expect(lines[1].amountCents).toBe(5000);
    });

    it("should record COGS and reduce Inventory asset upon sale", async () => {
      const layer = new InventoryCostLayer("L1", "VAR-A", "TEN-1", 10, 500, new Date(), "PO-100");
      await layersRepo.save(layer);

      const entry = await journalService.onStockSold(
        "VAR-A",
        3,
        3600,
        false,
        "Client XYZ",
        "SALE-99",
        new Date(),
        config,
        "TEN-1"
      );

      expect(entry).not.toBeNull();
      const lines = entry!.lines;
      expect(lines.length).toBe(4);

      expect(lines[0].account.code).toBe("1100");
      expect(lines[0].type).toBe(DebitCredit.Debit);
      expect(lines[0].amountCents).toBe(3600);

      expect(lines[1].account.code).toBe("4000");
      expect(lines[1].type).toBe(DebitCredit.Credit);
      expect(lines[1].amountCents).toBe(3600);

      expect(lines[2].account.code).toBe("5000");
      expect(lines[2].type).toBe(DebitCredit.Debit);
      expect(lines[2].amountCents).toBe(1500);

      expect(lines[3].account.code).toBe("1200");
      expect(lines[3].type).toBe(DebitCredit.Credit);
      expect(lines[3].amountCents).toBe(1500);
    });
  });

  describe("Cash Bookkeeping Flow", () => {
    const config = new TenantAccountingConfig(
      AccountingMethod.Cash,
      CostingMethod.WeightedAverageCost,
      "USD",
      "01-01"
    );

    it("should bypass receipt journal but record immediate expense when paid", async () => {
      const receiptEntry = await journalService.onStockReceived(
        "VAR-A",
        5000,
        "PO-100",
        "Supplier Inc",
        new Date(),
        config,
        "TEN-1"
      );
      expect(receiptEntry).toBeNull();

      const payEntry = await journalService.onSupplierPaid(
        5000,
        "PO-100",
        "Supplier Inc",
        new Date(),
        config,
        "TEN-1"
      );

      expect(payEntry).not.toBeNull();
      const lines = payEntry.lines;
      expect(lines.length).toBe(2);

      expect(lines[0].account.code).toBe("5100");
      expect(lines[0].type).toBe(DebitCredit.Debit);
      expect(lines[0].amountCents).toBe(5000);

      expect(lines[1].account.code).toBe("1000");
      expect(lines[1].type).toBe(DebitCredit.Credit);
      expect(lines[1].amountCents).toBe(5000);
    });

    it("should only record revenue upon immediate cash POS sales", async () => {
      const posEntry = await journalService.onStockSold(
        "VAR-A",
        1,
        1500,
        true,
        null,
        "SALE-101",
        new Date(),
        config,
        "TEN-1"
      );

      expect(posEntry).not.toBeNull();
      const posLines = posEntry!.lines;
      expect(posLines.length).toBe(2);
      expect(posLines[0].account.code).toBe("1000");
      expect(posLines[1].account.code).toBe("4000");

      const creditEntry = await journalService.onStockSold(
        "VAR-A",
        1,
        1500,
        false,
        "Client XYZ",
        "SALE-102",
        new Date(),
        config,
        "TEN-1"
      );
      expect(creditEntry).toBeNull();
    });
  });
});
