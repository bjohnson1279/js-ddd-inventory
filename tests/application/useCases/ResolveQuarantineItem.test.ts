import { ResolveQuarantineItem } from "../../../src/application/useCases/ResolveQuarantineItem";
import { InMemoryQuarantineRepository } from "../../../src/infrastructure/database/InMemoryQuarantineRepository";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { InMemoryCostLayerRepository } from "../../../src/infrastructure/database/InMemoryCostLayerRepository";
import { InMemoryTenantConfigRepository } from "../../../src/infrastructure/database/InMemoryTenantConfigRepository";
import { InMemoryJournalRepository } from "../../../src/infrastructure/database/InMemoryJournalRepository";
import { QuarantineItem } from "../../../src/domain/returns/aggregates/QuarantineItem";
import { TenantAccountingConfig } from "../../../src/domain/accounting/valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";
import { CostingMethod } from "../../../src/domain/accounting/enums/CostingMethod";
import { QuarantineStatus } from "../../../src/domain/returns/enums/QuarantineStatus";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { InventoryCostLayer } from "../../../src/domain/accounting/entities/InventoryCostLayer";
import { DebitCredit } from "../../../src/domain/accounting/enums/DebitCredit";

describe("ResolveQuarantineItem Use Case", () => {
  let quarantineRepository: InMemoryQuarantineRepository;
  let inventoryRepository: InMemoryInventoryRepository;
  let costLayerRepository: InMemoryCostLayerRepository;
  let tenantConfigRepository: InMemoryTenantConfigRepository;
  let journalRepository: InMemoryJournalRepository;

  let resolveUseCase: ResolveQuarantineItem;

  const tenantId = "TEN-1";
  const locationId = "loc-A";
  const quarantineLocId = "loc-A-quarantine";

  beforeEach(async () => {
    quarantineRepository = new InMemoryQuarantineRepository();
    inventoryRepository = new InMemoryInventoryRepository();
    costLayerRepository = new InMemoryCostLayerRepository();
    tenantConfigRepository = new InMemoryTenantConfigRepository();
    journalRepository = new InMemoryJournalRepository();

    resolveUseCase = new ResolveQuarantineItem(
      quarantineRepository,
      inventoryRepository,
      costLayerRepository,
      tenantConfigRepository,
      journalRepository
    );

    // Setup Accrual + FIFO config
    await tenantConfigRepository.save(
      tenantId,
      new TenantAccountingConfig(AccountingMethod.Accrual, CostingMethod.FIFO, "USD", "01-01")
    );
  });

  it("should restock a quarantined item, transferring quantity and cost layers to the standard location", async () => {
    // 1. Setup Quarantine Item & stock at quarantine location
    const qItem = new QuarantineItem("q-1", "VAR-A", 3, "Failed QA check", locationId, tenantId);
    await quarantineRepository.save(qItem);

    const sku = SKU.create("VAR-A");
    const qInvItem = InventoryItem.create("inv-q", sku, quarantineLocId, Quantity.create(3));
    await inventoryRepository.save(qInvItem);

    const layer = new InventoryCostLayer("L1", "VAR-A", tenantId, 3, 1000, new Date(), "RMA-1", quarantineLocId);
    await costLayerRepository.save(layer);

    // 2. Resolve to Restock
    await resolveUseCase.execute({
      quarantineItemId: "q-1",
      resolution: "RESTOCK",
    });

    // 3. Verify stock is transferred
    const updatedQInv = await inventoryRepository.findBySku(sku, quarantineLocId);
    const updatedStdInv = await inventoryRepository.findBySku(sku, locationId);
    expect(updatedQInv?.quantity.getValue()).toBe(0);
    expect(updatedStdInv?.quantity.getValue()).toBe(3);

    // 4. Verify cost layer is updated to standard location
    const activeLayers = await costLayerRepository.getActiveLayers("VAR-A");
    expect(activeLayers.length).toBe(1);
    expect(activeLayers[0].locationId).toBe(locationId);

    // 5. Verify QuarantineItem status
    const resolvedItem = await quarantineRepository.findById("q-1");
    expect(resolvedItem?.status).toBe(QuarantineStatus.Restocked);
  });

  it("should scrap a quarantined item, consuming cost layers and posting write-off ledger entries", async () => {
    // 1. Setup Quarantine Item & stock at quarantine location
    const qItem = new QuarantineItem("q-2", "VAR-B", 2, "Water damage", locationId, tenantId);
    await quarantineRepository.save(qItem);

    const sku = SKU.create("VAR-B");
    const qInvItem = InventoryItem.create("inv-q", sku, quarantineLocId, Quantity.create(2));
    await inventoryRepository.save(qInvItem);

    const layer = new InventoryCostLayer("L2", "VAR-B", tenantId, 2, 1200, new Date(), "RMA-2", quarantineLocId);
    await costLayerRepository.save(layer);

    // 2. Resolve to Scrap
    await resolveUseCase.execute({
      quarantineItemId: "q-2",
      resolution: "SCRAP",
    });

    // 3. Verify stock is cleared
    const updatedQInv = await inventoryRepository.findBySku(sku, quarantineLocId);
    expect(updatedQInv?.quantity.getValue()).toBe(0);

    // 4. Verify cost layer is consumed
    const activeLayers = await costLayerRepository.getActiveLayers("VAR-B");
    expect(activeLayers.length).toBe(0);

    // 5. Verify write-off journal (Debit: Write-Off Expense 5300, Credit: Inventory Asset 1200)
    const entries = await journalRepository.findAll(tenantId);
    expect(entries.length).toBe(1);
    expect(entries[0].lines[0].account.code).toBe("5300"); // Write-Off Expense
    expect(entries[0].lines[0].type).toBe(DebitCredit.Debit);
    expect(entries[0].lines[0].amountCents).toBe(2400);
    expect(entries[0].lines[1].account.code).toBe("1200"); // Inventory Asset
    expect(entries[0].lines[1].type).toBe(DebitCredit.Credit);
    expect(entries[0].lines[1].amountCents).toBe(2400);
  });

  it("should process return-to-vendor (RTV), consuming cost layers and debiting Accounts Payable", async () => {
    // 1. Setup Quarantine Item & stock at quarantine location
    const qItem = new QuarantineItem("q-3", "VAR-C", 1, "Incorrect item shipped", locationId, tenantId);
    await quarantineRepository.save(qItem);

    const sku = SKU.create("VAR-C");
    const qInvItem = InventoryItem.create("inv-q", sku, quarantineLocId, Quantity.create(1));
    await inventoryRepository.save(qInvItem);

    const layer = new InventoryCostLayer("L3", "VAR-C", tenantId, 1, 1500, new Date(), "RMA-3", quarantineLocId);
    await costLayerRepository.save(layer);

    // 2. Resolve to RTV
    await resolveUseCase.execute({
      quarantineItemId: "q-3",
      resolution: "RTV",
    });

    // 3. Verify stock is cleared
    const updatedQInv = await inventoryRepository.findBySku(sku, quarantineLocId);
    expect(updatedQInv?.quantity.getValue()).toBe(0);

    // 4. Verify cost layer is consumed
    const activeLayers = await costLayerRepository.getActiveLayers("VAR-C");
    expect(activeLayers.length).toBe(0);

    // 5. Verify RTV journal (Debit: Accounts Payable 2000, Credit: Inventory Asset 1200)
    const entries = await journalRepository.findAll(tenantId);
    expect(entries.length).toBe(1);
    expect(entries[0].lines[0].account.code).toBe("2000"); // Accounts Payable
    expect(entries[0].lines[0].type).toBe(DebitCredit.Debit);
    expect(entries[0].lines[0].amountCents).toBe(1500);
    expect(entries[0].lines[1].account.code).toBe("1200"); // Inventory Asset
    expect(entries[0].lines[1].type).toBe(DebitCredit.Credit);
    expect(entries[0].lines[1].amountCents).toBe(1500);
  });
});
