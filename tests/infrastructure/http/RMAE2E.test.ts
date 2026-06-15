process.env.NODE_ENV = "test";
process.env.SHOPIFY_API_SECRET = "dummy_test_secret";

import request from "supertest";
import jwt from "jsonwebtoken";
import { app, setupApp } from "../../../src/index";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { InMemoryCostLayerRepository } from "../../../src/infrastructure/database/InMemoryCostLayerRepository";
import { InMemoryTenantConfigRepository } from "../../../src/infrastructure/database/InMemoryTenantConfigRepository";
import { InMemoryJournalRepository } from "../../../src/infrastructure/database/InMemoryJournalRepository";
import { InMemoryRMARepository } from "../../../src/infrastructure/database/InMemoryRMARepository";
import { InMemoryQuarantineRepository } from "../../../src/infrastructure/database/InMemoryQuarantineRepository";
import { TenantAccountingConfig } from "../../../src/domain/accounting/valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";
import { CostingMethod } from "../../../src/domain/accounting/enums/CostingMethod";
import { RMAStatus } from "../../../src/domain/returns/enums/RMAStatus";
import { RMADisposition } from "../../../src/domain/returns/enums/RMADisposition";
import { QuarantineStatus } from "../../../src/domain/returns/enums/QuarantineStatus";
import { SKU } from "../../../src/domain/valueObjects/SKU";

const JWT_SECRET = "super-secret-key";

describe("RMA and Quarantine HTTP API Endpoints", () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let costLayerRepo: InMemoryCostLayerRepository;
  let tenantConfigRepo: InMemoryTenantConfigRepository;
  let journalRepo: InMemoryJournalRepository;
  let rmaRepo: InMemoryRMARepository;
  let quarantineRepo: InMemoryQuarantineRepository;
  let adminToken: string;
  let viewerToken: string;

  const tenantId = "TEN-E2E";
  const locationId = "loc-E2E";

  beforeEach(async () => {
    inventoryRepo = new InMemoryInventoryRepository();
    costLayerRepo = new InMemoryCostLayerRepository();
    tenantConfigRepo = new InMemoryTenantConfigRepository();
    journalRepo = new InMemoryJournalRepository();
    rmaRepo = new InMemoryRMARepository();
    quarantineRepo = new InMemoryQuarantineRepository();

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
      undefined,
      rmaRepo,
      quarantineRepo
    );

    adminToken = jwt.sign({ actorId: "admin-user", role: "admin", tenantId }, JWT_SECRET);
    viewerToken = jwt.sign({ actorId: "viewer-user", role: "viewer", tenantId }, JWT_SECRET);
  });

  describe("RBAC Permissions", () => {
    it("should deny viewer from performing mutating RMA & Quarantine operations", async () => {
      // Create RMA
      const rmaRes = await request(app)
        .post("/api/returns/rma")
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({
          rmaNumber: "RMA-2026-VIEW",
          tenantId,
          customerId: "CUST-E2E",
          locationId,
          items: [{ variantId: "VAR-X", quantity: 3, unitCostCents: 1000 }],
        });
      expect(rmaRes.status).toBe(403);

      // Authorize RMA
      const authRes = await request(app)
        .post(`/api/returns/rma/some-id/authorize`)
        .set("Authorization", `Bearer ${viewerToken}`);
      expect(authRes.status).toBe(403);

      // Receive RMA
      const receiveRes = await request(app)
        .post(`/api/returns/rma/some-id/receive`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({
          items: [{ variantId: "VAR-X", quantityReceived: 3, disposition: RMADisposition.Restock }],
        });
      expect(receiveRes.status).toBe(403);

      // Resolve Quarantine
      const resolveRes = await request(app)
        .post(`/api/returns/quarantine/some-id/resolve`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ resolution: "RESTOCK" });
      expect(resolveRes.status).toBe(403);
    });

    it("should allow viewer to read RMA & Quarantine data", async () => {
      const rmaRes = await request(app)
        .get("/api/returns/rma/some-id")
        .set("Authorization", `Bearer ${viewerToken}`);
      expect(rmaRes.status).toBe(404); // authenticates correctly but resource doesn't exist

      const quarantineRes = await request(app)
        .get("/api/returns/quarantine")
        .set("Authorization", `Bearer ${viewerToken}`);
      expect(quarantineRes.status).toBe(200);
    });
  });

  describe("Return & Quarantine Lifecycle", () => {
    it("should complete the full Return & Quarantine lifecycle", async () => {
      // 1. Create RMA request
      const createRes = await request(app)
        .post("/api/returns/rma")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          rmaNumber: "RMA-2026-E2E",
          tenantId,
          customerId: "CUST-E2E",
          locationId,
          items: [
            { variantId: "VAR-X", quantity: 3, unitCostCents: 1000 },
            { variantId: "VAR-Y", quantity: 2, unitCostCents: 2000 },
          ],
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.rmaNumber).toBe("RMA-2026-E2E");
      expect(createRes.body.status).toBe(RMAStatus.Requested);
      expect(createRes.body.items.length).toBe(2);

      const rmaId = createRes.body.id;

      // 2. Authorize RMA
      const authRes = await request(app)
        .post(`/api/returns/rma/${rmaId}/authorize`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(authRes.status).toBe(200);

      let updatedRma = await rmaRepo.findById(rmaId);
      expect(updatedRma?.status).toBe(RMAStatus.Authorized);

      // 3. Receive items (VAR-X restocked, VAR-Y quarantined)
      const receiveRes = await request(app)
        .post(`/api/returns/rma/${rmaId}/receive`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          items: [
            { variantId: "VAR-X", quantityReceived: 3, disposition: RMADisposition.Restock },
            { variantId: "VAR-Y", quantityReceived: 2, disposition: RMADisposition.Quarantine },
          ],
        });
      expect(receiveRes.status).toBe(200);

      // Verify stock adjustments
      const stockX = await inventoryRepo.findBySku(SKU.create("VAR-X"), locationId);
      const stockYQ = await inventoryRepo.findBySku(SKU.create("VAR-Y"), `${locationId}-quarantine`);
      expect(stockX?.quantity.getValue()).toBe(3);
      expect(stockYQ?.quantity.getValue()).toBe(2);

      // 4. List Quarantine items to find the created Quarantine item
      const listQRes = await request(app)
        .get("/api/returns/quarantine")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(listQRes.status).toBe(200);
      expect(listQRes.body.length).toBe(1);
      expect(listQRes.body[0].variantId).toBe("VAR-Y");
      expect(listQRes.body[0].quantity).toBe(2);
      expect(listQRes.body[0].status).toBe(QuarantineStatus.Quarantined);

      const qItemId = listQRes.body[0].id;

      // 5. Resolve Quarantine item as RESTOCK
      const resolveRes = await request(app)
        .post(`/api/returns/quarantine/${qItemId}/resolve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          resolution: "RESTOCK",
        });
      expect(resolveRes.status).toBe(200);

      // Verify stock is transferred to standard warehouse
      const stockYStd = await inventoryRepo.findBySku(SKU.create("VAR-Y"), locationId);
      const stockYQResolved = await inventoryRepo.findBySku(SKU.create("VAR-Y"), `${locationId}-quarantine`);
      expect(stockYStd?.quantity.getValue()).toBe(2);
      expect(stockYQResolved?.quantity.getValue()).toBe(0);

      // Verify resolved quarantine item details
      const getQRes = await request(app)
        .get(`/api/returns/quarantine/${qItemId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(getQRes.status).toBe(200);
      expect(getQRes.body.status).toBe(QuarantineStatus.Restocked);
      expect(getQRes.body.resolvedAt).not.toBeNull();
    });
  });
});
