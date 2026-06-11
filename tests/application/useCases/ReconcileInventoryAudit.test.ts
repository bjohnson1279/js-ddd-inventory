import { ReconcileInventoryAudit } from "../../../src/application/useCases/ReconcileInventoryAudit";
import { CreateInventoryAudit } from "../../../src/application/useCases/CreateInventoryAudit";
import { RecordAuditCount } from "../../../src/application/useCases/RecordAuditCount";
import { CompleteInventoryAudit } from "../../../src/application/useCases/CompleteInventoryAudit";
import { InMemoryInventoryAuditRepository } from "../../../src/infrastructure/database/InMemoryInventoryAuditRepository";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { InMemoryCostLayerRepository } from "../../../src/infrastructure/database/InMemoryCostLayerRepository";
import { InMemoryTenantConfigRepository } from "../../../src/infrastructure/database/InMemoryTenantConfigRepository";
import { InMemoryJournalRepository } from "../../../src/infrastructure/database/InMemoryJournalRepository";
import { TenantAccountingConfig } from "../../../src/domain/accounting/valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";
import { CostingMethod } from "../../../src/domain/accounting/enums/CostingMethod";
import { DebitCredit } from "../../../src/domain/accounting/enums/DebitCredit";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { InventoryCostLayer } from "../../../src/domain/accounting/entities/InventoryCostLayer";
import { AuditStatus } from "../../../src/domain/procurement/enums/AuditStatus";

describe("ReconcileInventoryAudit Use Case", () => {
  let auditRepository: InMemoryInventoryAuditRepository;
  let inventoryRepository: InMemoryInventoryRepository;
  let costLayerRepository: InMemoryCostLayerRepository;
  let tenantConfigRepository: InMemoryTenantConfigRepository;
  let journalRepository: InMemoryJournalRepository;

  let createUseCase: CreateInventoryAudit;
  let recordCountUseCase: RecordAuditCount;
  let completeUseCase: CompleteInventoryAudit;
  let reconcileUseCase: ReconcileInventoryAudit;

  const tenantId = "TEN-1";
  const locationId = "loc-A";

  beforeEach(async () => {
    auditRepository = new InMemoryInventoryAuditRepository();
    inventoryRepository = new InMemoryInventoryRepository();
    costLayerRepository = new InMemoryCostLayerRepository();
    tenantConfigRepository = new InMemoryTenantConfigRepository();
    journalRepository = new InMemoryJournalRepository();

    createUseCase = new CreateInventoryAudit(auditRepository, inventoryRepository);
    recordCountUseCase = new RecordAuditCount(auditRepository);
    completeUseCase = new CompleteInventoryAudit(auditRepository);
    reconcileUseCase = new ReconcileInventoryAudit(
      auditRepository,
      inventoryRepository,
      costLayerRepository,
      tenantConfigRepository,
      journalRepository
    );

    // Default tenant config: Accrual + FIFO
    await tenantConfigRepository.save(
      tenantId,
      new TenantAccountingConfig(AccountingMethod.Accrual, CostingMethod.FIFO, "USD", "01-01")
    );
  });

  it("should process shrinkage (negative discrepancy) under Accrual + FIFO costing", async () => {
    // 1. Setup inventory & cost layer
    const sku = SKU.create("VAR-SHRINK");
    const item = InventoryItem.create("inv-1", sku, locationId, Quantity.create(10));
    await inventoryRepository.save(item);

    // FIFO layers: Layer 1 (6 units @ $10.00), Layer 2 (4 units @ $12.00)
    const now = Date.now();
    const l1 = new InventoryCostLayer("L1", "VAR-SHRINK", tenantId, 6, 1000, new Date(now - 5000), "PO-1", locationId);
    const l2 = new InventoryCostLayer("L2", "VAR-SHRINK", tenantId, 4, 1200, new Date(now), "PO-2", locationId);
    await costLayerRepository.save(l1);
    await costLayerRepository.save(l2);

    // 2. Create Audit, Count, Complete
    const audit = await createUseCase.execute({
      auditNumber: "AUD-100",
      tenantId,
      locationId,
      variantIds: ["VAR-SHRINK"],
    });

    expect(audit.items[0].expectedQuantity).toBe(10);

    audit.start();
    await auditRepository.save(audit);

    await recordCountUseCase.execute({
      auditId: audit.id,
      variantId: "VAR-SHRINK",
      countedQuantity: 7, // Shrinkage of 3 units
    });

    await completeUseCase.execute(audit.id);

    // 3. Reconcile
    await reconcileUseCase.execute(audit.id);

    // 4. Verify stock level is decremented to 7
    const updatedItem = await inventoryRepository.findBySku(sku, locationId);
    expect(updatedItem?.quantity.getValue()).toBe(7);

    // 5. Verify cost layers: 3 units consumed from L1 (was 6, now 3 remaining)
    const activeLayers = await costLayerRepository.getActiveLayers("VAR-SHRINK", "asc");
    expect(activeLayers.length).toBe(2);
    expect(activeLayers[0].id).toBe("L1");
    expect(activeLayers[0].remainingQuantity).toBe(3);

    // 6. Verify journal entry posted for shrinkage expense: 3 units * 1000 cents = 3000 cents
    const entries = await journalRepository.findAll(tenantId);
    expect(entries.length).toBe(1);
    expect(entries[0].description).toContain("Inventory Shrinkage");
    expect(entries[0].lines.length).toBe(2);
    expect(entries[0].lines[0].account.code).toBe("5200"); // Inventory Shrinkage Expense
    expect(entries[0].lines[0].type).toBe(DebitCredit.Debit);
    expect(entries[0].lines[0].amountCents).toBe(3000);
    expect(entries[0].lines[1].account.code).toBe("1200"); // Inventory Asset
    expect(entries[0].lines[1].type).toBe(DebitCredit.Credit);
    expect(entries[0].lines[1].amountCents).toBe(3000);
  });

  it("should process gain (positive discrepancy) under Accrual + FIFO costing", async () => {
    // 1. Setup inventory & cost layer
    const sku = SKU.create("VAR-GAIN");
    const item = InventoryItem.create("inv-2", sku, locationId, Quantity.create(5));
    await inventoryRepository.save(item);

    // Latest layer unit cost = $15.00
    const now = Date.now();
    const l1 = new InventoryCostLayer("L1", "VAR-GAIN", tenantId, 5, 1500, new Date(now - 10000), "PO-3", locationId);
    await costLayerRepository.save(l1);

    // 2. Create Audit, Count, Complete
    const audit = await createUseCase.execute({
      auditNumber: "AUD-200",
      tenantId,
      locationId,
      variantIds: ["VAR-GAIN"],
    });

    audit.start();
    await auditRepository.save(audit);

    await recordCountUseCase.execute({
      auditId: audit.id,
      variantId: "VAR-GAIN",
      countedQuantity: 8, // Gain of 3 units
    });

    await completeUseCase.execute(audit.id);

    // 3. Reconcile
    await reconcileUseCase.execute(audit.id);

    // 4. Verify stock level is incremented to 8
    const updatedItem = await inventoryRepository.findBySku(sku, locationId);
    expect(updatedItem?.quantity.getValue()).toBe(8);

    // 5. Verify new cost layer is created with 3 units @ $15.00
    const activeLayers = await costLayerRepository.getActiveLayers("VAR-GAIN", "desc");
    expect(activeLayers.length).toBe(2);
    expect(activeLayers[0].purchaseOrderId).toBe(`AUDIT-${audit.id}`);
    expect(activeLayers[0].remainingQuantity).toBe(3);
    expect(activeLayers[0].unitCostCents).toBe(1500);

    // 6. Verify journal entry posted for adjustment gain: 3 units * 1500 cents = 4500 cents
    const entries = await journalRepository.findAll(tenantId);
    expect(entries.length).toBe(1);
    expect(entries[0].description).toContain("Inventory Gain");
    expect(entries[0].lines.length).toBe(2);
    expect(entries[0].lines[0].account.code).toBe("1200"); // Inventory Asset
    expect(entries[0].lines[0].type).toBe(DebitCredit.Debit);
    expect(entries[0].lines[0].amountCents).toBe(4500);
    expect(entries[0].lines[1].account.code).toBe("4100"); // Inventory Adjustment Gain
    expect(entries[0].lines[1].type).toBe(DebitCredit.Credit);
    expect(entries[0].lines[1].amountCents).toBe(4500);
  });

  it("should update stock but bypass ledger postings under Cash accounting", async () => {
    // 1. Setup Cash + WAC config
    await tenantConfigRepository.save(
      tenantId,
      new TenantAccountingConfig(AccountingMethod.Cash, CostingMethod.WeightedAverageCost, "USD", "01-01")
    );

    const sku = SKU.create("VAR-CASH");
    const item = InventoryItem.create("inv-3", sku, locationId, Quantity.create(5));
    await inventoryRepository.save(item);

    // 2. Create Audit, Count, Complete
    const audit = await createUseCase.execute({
      auditNumber: "AUD-300",
      tenantId,
      locationId,
      variantIds: ["VAR-CASH"],
    });

    audit.start();
    await auditRepository.save(audit);

    await recordCountUseCase.execute({
      auditId: audit.id,
      variantId: "VAR-CASH",
      countedQuantity: 3, // Shrinkage of 2 units
    });

    await completeUseCase.execute(audit.id);

    // 3. Reconcile
    await reconcileUseCase.execute(audit.id);

    // 4. Verify stock level is decremented to 3
    const updatedItem = await inventoryRepository.findBySku(sku, locationId);
    expect(updatedItem?.quantity.getValue()).toBe(3);

    // 5. Verify NO journal entries are created
    const entries = await journalRepository.findAll(tenantId);
    expect(entries.length).toBe(0);
  });
});
