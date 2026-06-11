process.env.NODE_ENV = "test";
process.env.SHOPIFY_API_SECRET = "dummy_test_secret";

import request from "supertest";
import { app, setupApp } from "../../../src/index";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { InMemoryCostLayerRepository } from "../../../src/infrastructure/database/InMemoryCostLayerRepository";
import { InMemoryTenantConfigRepository } from "../../../src/infrastructure/database/InMemoryTenantConfigRepository";
import { InMemoryJournalRepository } from "../../../src/infrastructure/database/InMemoryJournalRepository";
import { InMemoryInventoryAuditRepository } from "../../../src/infrastructure/database/InMemoryInventoryAuditRepository";
import { TenantAccountingConfig } from "../../../src/domain/accounting/valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";
import { CostingMethod } from "../../../src/domain/accounting/enums/CostingMethod";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { InventoryCostLayer } from "../../../src/domain/accounting/entities/InventoryCostLayer";
import { AuditStatus } from "../../../src/domain/procurement/enums/AuditStatus";

describe("Inventory Audit HTTP API Endpoints", () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let costLayerRepo: InMemoryCostLayerRepository;
  let tenantConfigRepo: InMemoryTenantConfigRepository;
  let journalRepo: InMemoryJournalRepository;
  let auditRepo: InMemoryInventoryAuditRepository;

  const tenantId = "TEN-E2E";
  const locationId = "loc-E2E";

  beforeEach(async () => {
    inventoryRepo = new InMemoryInventoryRepository();
    costLayerRepo = new InMemoryCostLayerRepository();
    tenantConfigRepo = new InMemoryTenantConfigRepository();
    journalRepo = new InMemoryJournalRepository();
    auditRepo = new InMemoryInventoryAuditRepository();

    await tenantConfigRepo.save(
      tenantId,
      new TenantAccountingConfig(AccountingMethod.Accrual, CostingMethod.FIFO, "USD", "01-01")
    );

    setupApp(
      inventoryRepo,
      undefined,
      undefined,
      costLayerRepo,
      journalRepo,
      tenantConfigRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      auditRepo
    );
  });

  it("should complete the physical audit cycle: Create -> Start -> Count -> Complete -> Reconcile", async () => {
    // 1. Setup inventory item and cost layers
    const sku = SKU.create("SKU-AUDIT");
    const item = InventoryItem.create("inv-id", sku, locationId, Quantity.create(10));
    await inventoryRepo.save(item);

    const layer = new InventoryCostLayer("L1", "SKU-AUDIT", tenantId, 10, 1000, new Date(), "PO-E2E", locationId);
    await costLayerRepo.save(layer);

    // 2. Create physical audit
    const createRes = await request(app)
      .post("/api/audits")
      .send({
        auditNumber: "AUD-E2E-1",
        tenantId,
        locationId,
        variantIds: ["SKU-AUDIT"],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.auditNumber).toBe("AUD-E2E-1");
    expect(createRes.body.status).toBe(AuditStatus.Draft);
    expect(createRes.body.items.length).toBe(1);
    expect(createRes.body.items[0].expectedQuantity).toBe(10);

    const auditId = createRes.body.id;

    // 3. Start audit
    const startRes = await request(app)
      .post(`/api/audits/${auditId}/start`);
    expect(startRes.status).toBe(200);

    let updatedAudit = await auditRepo.findById(auditId);
    expect(updatedAudit?.status).toBe(AuditStatus.InProgress);

    // 4. Record count
    const countRes = await request(app)
      .post(`/api/audits/${auditId}/count`)
      .send({
        variantId: "SKU-AUDIT",
        countedQuantity: 8, // discrepancy -2
      });
    expect(countRes.status).toBe(200);

    // 5. Complete audit
    const completeRes = await request(app)
      .post(`/api/audits/${auditId}/complete`);
    expect(completeRes.status).toBe(200);

    updatedAudit = await auditRepo.findById(auditId);
    expect(updatedAudit?.status).toBe(AuditStatus.Completed);

    // 6. Reconcile audit
    const reconcileRes = await request(app)
      .post(`/api/audits/${auditId}/reconcile`);
    expect(reconcileRes.status).toBe(200);

    // Verify final audit status
    updatedAudit = await auditRepo.findById(auditId);
    expect(updatedAudit?.status).toBe(AuditStatus.Reconciled);

    // Verify stock is adjusted
    const reconciledItem = await inventoryRepo.findBySku(sku, locationId);
    expect(reconciledItem?.quantity.getValue()).toBe(8);
  });
});
