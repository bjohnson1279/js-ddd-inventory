import { AccountingJournalService } from "../../../src/domain/accounting/services/AccountingJournalService";
import { CostLayerService } from "../../../src/domain/accounting/services/CostLayerService";
import { InMemoryJournalRepository } from "../../../src/infrastructure/database/InMemoryJournalRepository";
import { InMemoryCostLayerRepository } from "../../../src/infrastructure/database/InMemoryCostLayerRepository";
import { TenantAccountingConfig } from "../../../src/domain/accounting/valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";
import { CostingMethod } from "../../../src/domain/accounting/enums/CostingMethod";
import { InventoryCostLayer } from "../../../src/domain/accounting/entities/InventoryCostLayer";
import { DebitCredit } from "../../../src/domain/accounting/enums/DebitCredit";

describe("AccountingJournalService", () => {
  let journalRepo: InMemoryJournalRepository;
  let layersRepo: InMemoryCostLayerRepository;
  let costLayers: CostLayerService;
  let journalService: AccountingJournalService;

  const accrualFifoConfig = new TenantAccountingConfig(
    AccountingMethod.Accrual,
    CostingMethod.FIFO,
    "USD",
    "01-01"
  );

  const accrualWacConfig = new TenantAccountingConfig(
    AccountingMethod.Accrual,
    CostingMethod.WeightedAverageCost,
    "USD",
    "01-01"
  );

  const accrualSpecIdConfig = new TenantAccountingConfig(
    AccountingMethod.Accrual,
    CostingMethod.SpecificIdentification,
    "USD",
    "01-01"
  );

  const cashConfig = new TenantAccountingConfig(
    AccountingMethod.Cash,
    CostingMethod.WeightedAverageCost,
    "USD",
    "01-01"
  );

  beforeEach(() => {
    journalRepo = new InMemoryJournalRepository();
    layersRepo = new InMemoryCostLayerRepository();
    costLayers = new CostLayerService(layersRepo);
    journalService = new AccountingJournalService(journalRepo, costLayers);
  });

  describe("onStockReceived", () => {
    it("should create journal entry for Accrual method", async () => {
      const entry = await journalService.onStockReceived(
        "VAR-1",
        5000,
        "PO-1",
        "Supplier A",
        new Date(),
        accrualFifoConfig,
        "TENANT-1"
      );

      expect(entry).not.toBeNull();
      expect(entry!.tenantId).toBe("TENANT-1");
      expect(entry!.referenceId).toBe("PO-1");
      expect(entry!.lines.length).toBe(2);
      expect(entry!.lines[0].account.code).toBe("1200"); // Inventory
      expect(entry!.lines[0].amountCents).toBe(5000);
      expect(entry!.lines[0].type).toBe(DebitCredit.Debit);
      expect(entry!.lines[1].account.code).toBe("2000"); // AP
      expect(entry!.lines[1].amountCents).toBe(5000);
      expect(entry!.lines[1].type).toBe(DebitCredit.Credit);
    });

    it("should return null for Cash method", async () => {
      const entry = await journalService.onStockReceived(
        "VAR-1",
        5000,
        "PO-1",
        "Supplier A",
        new Date(),
        cashConfig,
        "TENANT-1"
      );

      expect(entry).toBeNull();
    });
  });

  describe("onStockReturned", () => {
    it("should create journal entry for Accrual method", async () => {
      const entry = await journalService.onStockReturned(
        "VAR-1",
        2000,
        "REF-1",
        new Date(),
        accrualFifoConfig,
        "TENANT-1"
      );

      expect(entry).not.toBeNull();
      expect(entry!.lines.length).toBe(2);
      expect(entry!.lines[0].account.code).toBe("1200"); // Inventory debit
      expect(entry!.lines[0].amountCents).toBe(2000);
      expect(entry!.lines[1].account.code).toBe("5000"); // COGS credit
      expect(entry!.lines[1].amountCents).toBe(2000);
    });

    it("should return null for Cash method", async () => {
      const entry = await journalService.onStockReturned(
        "VAR-1",
        2000,
        "REF-1",
        new Date(),
        cashConfig,
        "TENANT-1"
      );

      expect(entry).toBeNull();
    });
  });

  describe("onSupplierPaid", () => {
    it("should create journal entry clearing AP for Accrual method", async () => {
      const entry = await journalService.onSupplierPaid(
        3000,
        "PO-1",
        "Supplier A",
        new Date(),
        accrualFifoConfig,
        "TENANT-1"
      );

      expect(entry).not.toBeNull();
      expect(entry.lines.length).toBe(2);
      expect(entry.lines[0].account.code).toBe("2000"); // AP debit
      expect(entry.lines[0].amountCents).toBe(3000);
      expect(entry.lines[1].account.code).toBe("1000"); // Cash credit
      expect(entry.lines[1].amountCents).toBe(3000);
    });

    it("should create journal entry expensing purchase for Cash method", async () => {
      const entry = await journalService.onSupplierPaid(
        3000,
        "PO-1",
        "Supplier A",
        new Date(),
        cashConfig,
        "TENANT-1"
      );

      expect(entry).not.toBeNull();
      expect(entry.lines.length).toBe(2);
      expect(entry.lines[0].account.code).toBe("5100"); // Inventory expense debit
      expect(entry.lines[0].amountCents).toBe(3000);
      expect(entry.lines[1].account.code).toBe("1000"); // Cash credit
      expect(entry.lines[1].amountCents).toBe(3000);
    });
  });

  describe("onStockSold", () => {
    beforeEach(async () => {
      const layer = new InventoryCostLayer(
        "L1",
        "VAR-1",
        "TENANT-1",
        10,
        1000, // 1000 cents per unit
        new Date(),
        "PO-1"
      );
      await layersRepo.save(layer);
    });

    it("should handle Accrual FIFO stock sale with immediate cash payment", async () => {
      const entry = await journalService.onStockSold(
        "VAR-1",
        2,
        4000,
        true,
        "Customer A",
        "SALE-1",
        new Date(),
        accrualFifoConfig,
        "TENANT-1"
      );

      expect(entry).not.toBeNull();
      expect(entry!.lines.length).toBe(4);
      expect(entry!.lines[0].account.code).toBe("1000"); // Cash debit
      expect(entry!.lines[0].amountCents).toBe(4000);
      expect(entry!.lines[1].account.code).toBe("4000"); // Sales revenue credit
      expect(entry!.lines[1].amountCents).toBe(4000);
      expect(entry!.lines[2].account.code).toBe("5000"); // COGS debit
      expect(entry!.lines[2].amountCents).toBe(2000);
      expect(entry!.lines[3].account.code).toBe("1200"); // Inventory credit
      expect(entry!.lines[3].amountCents).toBe(2000);
    });

    it("should handle Accrual FIFO stock sale with accounts receivable", async () => {
      const entry = await journalService.onStockSold(
        "VAR-1",
        2,
        4000,
        false,
        "Customer A",
        "SALE-1",
        new Date(),
        accrualFifoConfig,
        "TENANT-1"
      );

      expect(entry).not.toBeNull();
      expect(entry!.lines[0].account.code).toBe("1100"); // AR debit
      expect(entry!.lines[0].memo).toBe("AR — Customer A");
    });

    it("should default customer memo to Walk-in Customer when customerName is null for AR", async () => {
      const entry = await journalService.onStockSold(
        "VAR-1",
        2,
        4000,
        false,
        null,
        "SALE-1",
        new Date(),
        accrualFifoConfig,
        "TENANT-1"
      );

      expect(entry).not.toBeNull();
      expect(entry!.lines[0].memo).toBe("AR — Walk-in Customer");
    });

    it("should handle Accrual WAC stock sale", async () => {
      const entry = await journalService.onStockSold(
        "VAR-1",
        2,
        4000,
        true,
        "Customer A",
        "SALE-1",
        new Date(),
        accrualWacConfig,
        "TENANT-1"
      );

      expect(entry).not.toBeNull();
      expect(entry!.lines[2].account.code).toBe("5000"); // COGS
      expect(entry!.lines[2].amountCents).toBe(2000);
    });

    it("should throw error when costingMethod is SpecificIdentification in Accrual mode", async () => {
      await expect(
        journalService.onStockSold(
          "VAR-1",
          2,
          4000,
          true,
          "Customer A",
          "SALE-1",
          new Date(),
          accrualSpecIdConfig,
          "TENANT-1"
        )
      ).rejects.toThrow("SpecificIdentification requires serial numbers. Use a dedicated path.");
    });

    it("should handle Cash stock sale with payment received now", async () => {
      const entry = await journalService.onStockSold(
        "VAR-1",
        2,
        4000,
        true,
        "Customer A",
        "SALE-1",
        new Date(),
        cashConfig,
        "TENANT-1"
      );

      expect(entry).not.toBeNull();
      expect(entry!.lines.length).toBe(2);
      expect(entry!.lines[0].account.code).toBe("1000"); // Cash debit
      expect(entry!.lines[0].amountCents).toBe(4000);
      expect(entry!.lines[1].account.code).toBe("4000"); // Revenue credit
      expect(entry!.lines[1].amountCents).toBe(4000);
    });

    it("should return null for Cash stock sale when payment is not received now", async () => {
      const entry = await journalService.onStockSold(
        "VAR-1",
        2,
        4000,
        false,
        "Customer A",
        "SALE-1",
        new Date(),
        cashConfig,
        "TENANT-1"
      );

      expect(entry).toBeNull();
    });
  });

  describe("onCustomerPaymentReceived", () => {
    it("should clear AR for Accrual method", async () => {
      const entry = await journalService.onCustomerPaymentReceived(
        1500,
        "INV-100",
        "Customer A",
        new Date(),
        accrualFifoConfig,
        "TENANT-1"
      );

      expect(entry).not.toBeNull();
      expect(entry!.lines.length).toBe(2);
      expect(entry!.lines[0].account.code).toBe("1000"); // Cash debit
      expect(entry!.lines[0].amountCents).toBe(1500);
      expect(entry!.lines[1].account.code).toBe("1100"); // AR credit
      expect(entry!.lines[1].amountCents).toBe(1500);
    });

    it("should record revenue for Cash method", async () => {
      const entry = await journalService.onCustomerPaymentReceived(
        1500,
        "INV-100",
        "Customer A",
        new Date(),
        cashConfig,
        "TENANT-1"
      );

      expect(entry).not.toBeNull();
      expect(entry!.lines.length).toBe(2);
      expect(entry!.lines[0].account.code).toBe("1000"); // Cash debit
      expect(entry!.lines[0].amountCents).toBe(1500);
      expect(entry!.lines[1].account.code).toBe("4000"); // Sales revenue credit
      expect(entry!.lines[1].amountCents).toBe(1500);
    });
  });

  describe("onInventoryAuditReconciliation", () => {
    it("should record shrinkage expense when discrepancy < 0 in Accrual mode", async () => {
      const entry = await journalService.onInventoryAuditReconciliation(
        "AUDIT-1",
        "VAR-1",
        -5,
        2500,
        new Date(),
        accrualFifoConfig,
        "TENANT-1"
      );

      expect(entry).not.toBeNull();
      expect(entry!.lines.length).toBe(2);
      expect(entry!.lines[0].account.code).toBe("5200"); // Shrinkage expense debit
      expect(entry!.lines[0].amountCents).toBe(2500);
      expect(entry!.lines[1].account.code).toBe("1200"); // Inventory credit
      expect(entry!.lines[1].amountCents).toBe(2500);
    });

    it("should record adjustment gain when discrepancy > 0 in Accrual mode", async () => {
      const entry = await journalService.onInventoryAuditReconciliation(
        "AUDIT-1",
        "VAR-1",
        5,
        2500,
        new Date(),
        accrualFifoConfig,
        "TENANT-1"
      );

      expect(entry).not.toBeNull();
      expect(entry!.lines.length).toBe(2);
      expect(entry!.lines[0].account.code).toBe("1200"); // Inventory debit
      expect(entry!.lines[0].amountCents).toBe(2500);
      expect(entry!.lines[1].account.code).toBe("4100"); // Adjustment gain credit
      expect(entry!.lines[1].amountCents).toBe(2500);
    });

    it("should return null when discrepancy is 0 in Accrual mode", async () => {
      const entry = await journalService.onInventoryAuditReconciliation(
        "AUDIT-1",
        "VAR-1",
        0,
        0,
        new Date(),
        accrualFifoConfig,
        "TENANT-1"
      );

      expect(entry).toBeNull();
    });

    it("should return null for Cash mode", async () => {
      const entry = await journalService.onInventoryAuditReconciliation(
        "AUDIT-1",
        "VAR-1",
        -5,
        2500,
        new Date(),
        cashConfig,
        "TENANT-1"
      );

      expect(entry).toBeNull();
    });
  });

  describe("onInventoryWriteOff", () => {
    it("should create write-off journal entry in Accrual mode", async () => {
      const entry = await journalService.onInventoryWriteOff(
        "WO-1",
        1800,
        new Date(),
        accrualFifoConfig,
        "TENANT-1"
      );

      expect(entry).not.toBeNull();
      expect(entry!.lines.length).toBe(2);
      expect(entry!.lines[0].account.code).toBe("5300"); // Write-off expense debit
      expect(entry!.lines[0].amountCents).toBe(1800);
      expect(entry!.lines[1].account.code).toBe("1200"); // Inventory credit
      expect(entry!.lines[1].amountCents).toBe(1800);
    });

    it("should return null for Cash mode", async () => {
      const entry = await journalService.onInventoryWriteOff(
        "WO-1",
        1800,
        new Date(),
        cashConfig,
        "TENANT-1"
      );

      expect(entry).toBeNull();
    });
  });

  describe("onReturnToVendor", () => {
    it("should create return to vendor entry in Accrual mode", async () => {
      const entry = await journalService.onReturnToVendor(
        "RTV-1",
        3500,
        new Date(),
        accrualFifoConfig,
        "TENANT-1"
      );

      expect(entry).not.toBeNull();
      expect(entry!.lines.length).toBe(2);
      expect(entry!.lines[0].account.code).toBe("2000"); // AP debit
      expect(entry!.lines[0].amountCents).toBe(3500);
      expect(entry!.lines[1].account.code).toBe("1200"); // Inventory credit
      expect(entry!.lines[1].amountCents).toBe(3500);
    });

    it("should return null for Cash mode", async () => {
      const entry = await journalService.onReturnToVendor(
        "RTV-1",
        3500,
        new Date(),
        cashConfig,
        "TENANT-1"
      );

      expect(entry).toBeNull();
    });
  });

  describe("onKitAssembly", () => {
    it("should debit Kit inventory and credit Component inventory", async () => {
      const entry = await journalService.onKitAssembly(
        "TENANT-1",
        new Date(),
        "Assemble Kit A",
        "KIT-ASS-1",
        "KIT-SKU-1",
        8000
      );

      expect(entry).not.toBeNull();
      expect(entry.lines.length).toBe(2);
      expect(entry.lines[0].account.code).toBe("1200"); // Kit inventory debit
      expect(entry.lines[0].amountCents).toBe(8000);
      expect(entry.lines[1].account.code).toBe("1210"); // Component inventory credit
      expect(entry.lines[1].amountCents).toBe(8000);
    });
  });

  describe("onKitDisassembly", () => {
    it("should debit Component inventory and credit Kit inventory", async () => {
      const entry = await journalService.onKitDisassembly(
        "TENANT-1",
        new Date(),
        "Disassemble Kit A",
        "KIT-DIS-1",
        "KIT-SKU-1",
        8000
      );

      expect(entry).not.toBeNull();
      expect(entry.lines.length).toBe(2);
      expect(entry.lines[0].account.code).toBe("1210"); // Component inventory debit
      expect(entry.lines[0].amountCents).toBe(8000);
      expect(entry.lines[1].account.code).toBe("1200"); // Kit inventory credit
      expect(entry.lines[1].amountCents).toBe(8000);
    });
  });
});
