process.env.NODE_ENV = "test";
process.env.SHOPIFY_API_SECRET = "dummy_test_secret";

import request from "supertest";
import { app, setupApp } from "../../../src/index";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { prisma } from "../../../src/infrastructure/database/prisma";
import * as crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { InventoryCostLayer } from "../../../src/domain/accounting/entities/InventoryCostLayer";

describe("E2E Integration Test Suite", () => {
  let repository: InMemoryInventoryRepository;

  beforeEach(async () => {
    repository = new InMemoryInventoryRepository();
    setupApp(repository);

    // Reset database state for clean test runs
    await prisma.statusTransitionModel.deleteMany();
    await prisma.serializedItemModel.deleteMany();
    await prisma.barcodeAssignmentModel.deleteMany();
    await prisma.inventoryCostLayerModel.deleteMany();
    await prisma.journalLineModel.deleteMany();
    await prisma.journalEntryModel.deleteMany();
    await prisma.kitComponentModel.deleteMany();
    await prisma.kitModel.deleteMany();
  });

  describe("Inventory Endpoints", () => {
    it("should receive stock via POST /api/inventory/receive", async () => {
      const response = await request(app)
        .post("/api/inventory/receive")
        .send({ sku: "IPHONE-15-PRO-BLK", amount: 50 });

      expect(response.status).toBe(200);
      expect(response.body.message).toMatch(/success/i);

      const item = await repository.findBySku(SKU.create("IPHONE-15-PRO-BLK"));
      expect(item?.quantity.getValue()).toBe(50);
    });

    it("should dispatch stock via POST /api/inventory/dispatch", async () => {
      const item = InventoryItem.create("1", SKU.create("IPHONE-15-PRO-BLK"), Quantity.create(10));
      await repository.save(item);

      const response = await request(app)
        .post("/api/inventory/dispatch")
        .send({ sku: "IPHONE-15-PRO-BLK", amount: 3 });

      expect(response.status).toBe(200);
      expect(response.body.message).toMatch(/success/i);

      const updated = await repository.findBySku(SKU.create("IPHONE-15-PRO-BLK"));
      expect(updated?.quantity.getValue()).toBe(7);
    });

    it("should get current stock level via GET /api/inventory/:sku", async () => {
      const item = InventoryItem.create("1", SKU.create("IPHONE-15-PRO-BLK"), Quantity.create(45));
      await repository.save(item);

      const response = await request(app).get("/api/inventory/IPHONE-15-PRO-BLK");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        sku: "IPHONE-15-PRO-BLK",
        quantity: 45,
        allocated: 0,
        inTransit: 0,
        available: 45,
      });
    });

    it("should perform full physical counts via POST /api/inventory/count", async () => {
      const item = InventoryItem.create("1", SKU.create("IPHONE-15-PRO-BLK"), Quantity.create(10));
      await repository.save(item);

      const response = await request(app)
        .post("/api/inventory/count")
        .send({
          counts: [
            { sku: "IPHONE-15-PRO-BLK", count: 42 },
            { sku: "IPHONE-15-PRO-WHT", count: 10 },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toMatch(/success/i);


      const updated1 = await repository.findBySku(SKU.create("IPHONE-15-PRO-BLK"));
      const updated2 = await repository.findBySku(SKU.create("IPHONE-15-PRO-WHT"));

      expect(updated1?.quantity.getValue()).toBe(42);
      expect(updated2?.quantity.getValue()).toBe(10);
    });
  });

  describe("Onboarding Endpoints", () => {
    it("should submit stock onboarding via POST /api/onboarding/submit", async () => {
      const response = await request(app)
        .post("/api/onboarding/submit")
        .send({
          locationId: "Main-Store",
          asOfDate: "2026-05-30",
          items: [{ sku: "SKU-ONBOARD-1", quantity: 15, unitCostCents: 200 }],
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toMatch(/success/i);

      const updated = await repository.findBySku(SKU.create("SKU-ONBOARD-1"));
      expect(updated?.quantity.getValue()).toBe(15);
    });
  });

  describe("Shopify Webhook Endpoints", () => {
    it("should process Shopify webhooks with valid HMAC signature", async () => {
      const item = InventoryItem.create("1", SKU.create("IPHONE-15-PRO-BLK"), Quantity.create(5));
      await repository.save(item);

      const payload = {
        line_items: [{ sku: "IPHONE-15-PRO-BLK", quantity: 1 }],
      };

      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac("sha256", "dummy_test_secret").update(rawBody, "utf8").digest("base64");

      const response = await request(app)
        .post("/api/shopify/webhooks/orders/create")
        .set("X-Shopify-Hmac-Sha256", hmac)
        .set("X-Shopify-Topic", "orders/create")
        .set("X-Shopify-Webhook-Id", "WEBHOOK-12345")
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.text).toBe("Webhook processed");

      const updated = await repository.findBySku(SKU.create("IPHONE-15-PRO-BLK"));
      expect(updated?.quantity.getValue()).toBe(4);
    });

    it("should ignore duplicate Shopify webhooks with the same X-Shopify-Webhook-Id", async () => {
      const item = InventoryItem.create("2", SKU.create("IPHONE-15-PRO-BLK"), Quantity.create(5));
      await repository.save(item);

      const payload = {
        line_items: [{ sku: "IPHONE-15-PRO-BLK", quantity: 1 }],
      };

      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac("sha256", "dummy_test_secret").update(rawBody, "utf8").digest("base64");

      // First webhook call
      const response1 = await request(app)
        .post("/api/shopify/webhooks/orders/create")
        .set("X-Shopify-Hmac-Sha256", hmac)
        .set("X-Shopify-Topic", "orders/create")
        .set("X-Shopify-Webhook-Id", "WEBHOOK-DUPE")
        .send(payload);

      expect(response1.status).toBe(200);
      expect(response1.text).toBe("Webhook processed");

      // Verify deduction occurred once
      let updated = await repository.findBySku(SKU.create("IPHONE-15-PRO-BLK"));
      expect(updated?.quantity.getValue()).toBe(4);

      // Second identical webhook call (replay attack)
      const response2 = await request(app)
        .post("/api/shopify/webhooks/orders/create")
        .set("X-Shopify-Hmac-Sha256", hmac)
        .set("X-Shopify-Topic", "orders/create")
        .set("X-Shopify-Webhook-Id", "WEBHOOK-DUPE")
        .send(payload);

      expect(response2.status).toBe(200);
      expect(response2.text).toBe("Webhook already processed");

      // Verify deduction was NOT applied again
      updated = await repository.findBySku(SKU.create("IPHONE-15-PRO-BLK"));
      expect(updated?.quantity.getValue()).toBe(4);
    });

    it("should reject Shopify webhooks with missing X-Shopify-Webhook-Id header", async () => {
      const response = await request(app)
        .post("/api/shopify/webhooks/orders/create")
        .set("X-Shopify-Hmac-Sha256", "some-hmac")
        .set("X-Shopify-Topic", "orders/create")
        .send({});

      expect(response.status).toBe(400);
      expect(response.text).toBe("Missing Webhook ID header");
    });

    it("should reject Shopify webhooks with invalid HMAC signature", async () => {
      const response = await request(app)
        .post("/api/shopify/webhooks/orders/create")
        .set("X-Shopify-Hmac-Sha256", "bad-hmac")
        .set("X-Shopify-Topic", "orders/create")
        .set("X-Shopify-Webhook-Id", "WEBHOOK-999")
        .send({});

      expect(response.status).toBe(401);
      expect(response.text).toBe("Invalid HMAC signature");
    });
  });

  describe("Barcode Endpoints", () => {
    it("should assign and scan barcodes", async () => {
      // 1. Assign barcode
      const assignRes = await request(app)
        .post("/api/barcodes/assign")
        .send({
          variantId: "VAR-B1",
          symbology: "upc_a",
          barcodeValue: "012345678905",
          source: "internal",
          isPrimary: true
        });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.message).toMatch(/assigned/i);

      // 2. Scan barcode
      const scanRes = await request(app)
        .post("/api/barcodes/scan")
        .send({
          rawScan: "012345678905",
          context: "pos"
        });

      expect(scanRes.status).toBe(200);
      expect(scanRes.body.variantId).toBe("VAR-B1");
    });

    it("should generate Code 128 barcode", async () => {
      const genRes = await request(app)
        .post("/api/barcodes/generate")
        .send({ variantId: "VAR-B2" });

      expect(genRes.status).toBe(200);
      expect(genRes.body.barcodeValue).toBeDefined();
    });
  });

  describe("Serial Endpoints", () => {
    it("should register, receive, sell and fetch timeline history", async () => {
      const serial = "ABC-12345";
      // 1. Register serial number
      const regRes = await request(app)
        .post("/api/serials/register")
        .send({
          serialNumber: serial,
          variantId: "VAR-S1",
          tenantId: "DEFAULT",
          locationId: "LOC-M1",
          actorId: "admin-actor"
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.message).toMatch(/registered/i);

      // 2. Receive serial item (increments general stock)
      const recRes = await request(app)
        .post("/api/serials/receive")
        .send({
          serialNumber: serial,
          tenantId: "DEFAULT",
          locationId: "LOC-M1",
          purchaseOrderId: "PO-X12",
          actorId: "admin-actor"
        });

      expect(recRes.status).toBe(200);
      expect(recRes.body.message).toMatch(/received/i);

      // 3. Sell serial item (decrements general stock)
      const sellRes = await request(app)
        .post("/api/serials/sell")
        .send({
          serialNumber: serial,
          tenantId: "DEFAULT",
          saleId: "SALE-Y34",
          actorId: "seller-actor"
        });

      expect(sellRes.status).toBe(200);

      // 4. Retrieve transition timeline history
      const histRes = await request(app).get(`/api/serials/${serial}/history`);
      expect(histRes.status).toBe(200);
      expect(histRes.body.serialNumber).toBe(serial);
      expect(histRes.body.history.length).toBe(2);
      expect(histRes.body.history[0].to).toBe("in_stock");
      expect(histRes.body.history[1].to).toBe("sold");
    });
  });

  describe("Kit Endpoints", () => {
    it("should create kit formulas and atomically dispatch kit sales", async () => {
      // Setup component quantities
      await repository.save(InventoryItem.create("1", SKU.create("COMP-1"), Quantity.create(10)));
      await repository.save(InventoryItem.create("2", SKU.create("COMP-2"), Quantity.create(20)));

      // 1. Create kit
      const kitRes = await request(app)
        .post("/api/kits/create")
        .send({
          sku: "KIT-A",
          name: "Bundle Package A",
          components: [
            { variantId: "COMP-1", quantity: 2 },
            { variantId: "COMP-2", quantity: 5 }
          ]
        });

      expect(kitRes.status).toBe(201);

      // 2. Dispatch kit sale
      const saleRes = await request(app)
        .post("/api/kits/dispatch")
        .send({
          kitSku: "KIT-A",
          quantity: 2,
          saleId: "S-555",
          actorId: "cashier-1"
        });

      expect(saleRes.status).toBe(200);

      // 3. Verify component stocks decremented atomically (2 kits * 2 comp1 = 4 units, 2 kits * 5 comp2 = 10 units)
      const c1 = await repository.findBySku(SKU.create("COMP-1"));
      const c2 = await repository.findBySku(SKU.create("COMP-2"));

      expect(c1?.quantity.getValue()).toBe(6);
      expect(c2?.quantity.getValue()).toBe(10);
    });

    it("should assemble and disassemble kits, recording costing layers and journal entries, and enforce RBAC", async () => {
      // 1. Save components inventory and costing layers
      const comp1Sku = "COMP-A";
      const comp2Sku = "COMP-B";
      const kitSku = "KIT-BUNDLE";
      const tenantId = "tenant-1";
      const locationId = "default";

      // Seed component stocks
      await repository.save(InventoryItem.create("c1", SKU.create(comp1Sku), Quantity.create(10)));
      await repository.save(InventoryItem.create("c2", SKU.create(comp2Sku), Quantity.create(20)));

      // Seed costing layers for COMP-A (unit cost 100) and COMP-B (unit cost 200)
      const costLayerRepo = app.get("costLayerRepository");
      await costLayerRepo.save(new InventoryCostLayer("l1", comp1Sku, tenantId, 10, 100, new Date(), "PO-1", locationId));
      await costLayerRepo.save(new InventoryCostLayer("l2", comp2Sku, tenantId, 20, 200, new Date(), "PO-2", locationId));

      // Configure tenant to Accrual and FIFO
      const tenantConfigRepo = app.get("tenantConfigRepository");
      const { TenantAccountingConfig } = require("../../../src/domain/accounting/valueObjects/TenantAccountingConfig");
      const { AccountingMethod } = require("../../../src/domain/accounting/enums/AccountingMethod");
      const { CostingMethod } = require("../../../src/domain/accounting/enums/CostingMethod");
      await tenantConfigRepo.save(tenantId, new TenantAccountingConfig(AccountingMethod.Accrual, CostingMethod.FIFO, "USD", "01-01"));

      // 2. Create Kit formula
      const createRes = await request(app)
        .post("/api/kits/create")
        .send({
          sku: kitSku,
          name: "Test Kit Bundle",
          components: [
            { variantId: comp1Sku, quantity: 2 },
            { variantId: comp2Sku, quantity: 1 }
          ]
        });
      expect(createRes.status).toBe(201);

      // Sign tokens for RBAC tests
      const JWT_SECRET = "super-secret-key";
      const adminToken = jwt.sign({ actorId: "admin-user", role: "admin", tenantId }, JWT_SECRET);
      const viewerToken = jwt.sign({ actorId: "viewer-user", role: "viewer", tenantId }, JWT_SECRET);

      // Test RBAC rejection on assemble
      const unauthorizedAssembleRes = await request(app)
        .post("/api/kits/assemble")
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ kitSku, quantity: 2, locationId, referenceId: "REF-ASM-1" });
      expect(unauthorizedAssembleRes.status).toBe(403);

      // Test RBAC rejection on disassemble
      const unauthorizedDisassembleRes = await request(app)
        .post("/api/kits/disassemble")
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ kitSku, quantity: 2, locationId, referenceId: "REF-DIS-1" });
      expect(unauthorizedDisassembleRes.status).toBe(403);

      // 3. Assemble Kit (2 units)
      // Needs 2 * 2 = 4 units of COMP-A (cost 4 * 100 = 400) and 2 * 1 = 2 units of COMP-B (cost 2 * 200 = 400). Total cost = 800.
      const assembleRes = await request(app)
        .post("/api/kits/assemble")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ kitSku, quantity: 2, locationId, referenceId: "REF-ASM-1" });
      expect(assembleRes.status).toBe(200);

      // Verify stock levels: COMP-A should be 6, COMP-B should be 18, KIT should be 2.
      const comp1Inv = await repository.findBySku(SKU.create(comp1Sku));
      const comp2Inv = await repository.findBySku(SKU.create(comp2Sku));
      const kitInv = await repository.findBySku(SKU.create(kitSku));
      expect(comp1Inv?.quantity.getValue()).toBe(6);
      expect(comp2Inv?.quantity.getValue()).toBe(18);
      expect(kitInv?.quantity.getValue()).toBe(2);

      // Verify Kit costing layer: unit cost should be 400 (800 / 2)
      const activeKitLayers = await costLayerRepo.getActiveLayers(kitSku);
      expect(activeKitLayers).toHaveLength(1);
      expect(activeKitLayers[0].remainingQuantity).toBe(2);
      expect(activeKitLayers[0].unitCostCents).toBe(400);

      // Verify Journal Entries: Debit Kit (1200) for 800, Credit Component (1210) for 800.
      const journalRepo = app.get("journalRepository");
      const journalEntries = await journalRepo.findAll(tenantId);
      expect(journalEntries.length).toBeGreaterThan(0);
      const asmEntry = journalEntries.find((e: any) => e.referenceId === "REF-ASM-1");
      expect(asmEntry).toBeDefined();
      expect(asmEntry.lines).toHaveLength(2);
      const debitLine = asmEntry.lines.find((l: any) => l.account.code === "1200");
      const creditLine = asmEntry.lines.find((l: any) => l.account.code === "1210");
      expect(debitLine.amountCents).toBe(800);
      expect(debitLine.type).toBe("debit");
      expect(creditLine.amountCents).toBe(800);
      expect(creditLine.type).toBe("credit");

      // 4. Disassemble Kit (2 units)
      // Restores components: 4 units of COMP-A, 2 units of COMP-B.
      // Scaled cost: since no estimated component cost changes, scale factor is 1.0.
      // COMP-A is restored at 100 unit cost, COMP-B at 200 unit cost.
      const disassembleRes = await request(app)
        .post("/api/kits/disassemble")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ kitSku, quantity: 2, locationId, referenceId: "REF-DIS-1" });
      expect(disassembleRes.status).toBe(200);

      // Verify stock levels: COMP-A should be 10, COMP-B should be 20, KIT should be 0.
      const comp1InvPost = await repository.findBySku(SKU.create(comp1Sku));
      const comp2InvPost = await repository.findBySku(SKU.create(comp2Sku));
      const kitInvPost = await repository.findBySku(SKU.create(kitSku));
      expect(comp1InvPost?.quantity.getValue()).toBe(10);
      expect(comp2InvPost?.quantity.getValue()).toBe(20);
      expect(kitInvPost?.quantity.getValue()).toBe(0);

      // Verify Journal Entries for Disassembly: Debit Component (1210) for 800, Credit Kit (1200) for 800.
      const journalEntriesPost = await journalRepo.findAll(tenantId);
      const disEntry = journalEntriesPost.find((e: any) => e.referenceId === "REF-DIS-1");
      expect(disEntry).toBeDefined();
      expect(disEntry.lines).toHaveLength(2);
      const debitLinePost = disEntry.lines.find((l: any) => l.account.code === "1210");
      const creditLinePost = disEntry.lines.find((l: any) => l.account.code === "1200");
      expect(debitLinePost.amountCents).toBe(800);
      expect(debitLinePost.type).toBe("debit");
      expect(creditLinePost.amountCents).toBe(800);
      expect(creditLinePost.type).toBe("credit");
    });
  });

  describe("Accounting Endpoints", () => {
    it("should log stock receipts, sales, and report ledger audits", async () => {
      // 1. Log stock receipt
      const recRes = await request(app)
        .post("/api/accounting/stock-received")
        .send({
          variantId: "VAR-AC1",
          totalCostCents: 10000,
          purchaseOrderId: "PO-777",
          supplierName: "Acme Corp",
          tenantId: "TEN-A"
        });

      expect(recRes.status).toBe(200);
      expect(recRes.body.journalEntryId).toBeDefined();

      // 2. Read ledger accounts
      const ledRes = await request(app).get("/api/accounting/ledger");
      expect(ledRes.status).toBe(200);
      expect(ledRes.body.length).toBeGreaterThan(0);
      expect(ledRes.body.some((e: any) => e.description.includes("PO-777"))).toBe(true);

      // 3. Verify tenant filtering on ledger
      const filteredLedRes = await request(app).get("/api/accounting/ledger?tenantId=TEN-A");
      expect(filteredLedRes.status).toBe(200);
      expect(filteredLedRes.body.some((e: any) => e.description.includes("PO-777"))).toBe(true);

      const otherTenantLedRes = await request(app).get("/api/accounting/ledger?tenantId=OTHER-TENANT");
      expect(otherTenantLedRes.status).toBe(200);
      expect(otherTenantLedRes.body.some((e: any) => e.description.includes("PO-777"))).toBe(false);
    });

    it("should get and set tenant configurations dynamically", async () => {
      const saveRes = await request(app)
        .post("/api/accounting/tenant-config")
        .send({
          tenantId: "TENANT-XYZ",
          accountingMethod: "cash",
          costingMethod: "weighted_average_cost",
          currencyCode: "EUR",
          fiscalYearStart: "03-01"
        });

      expect(saveRes.status).toBe(200);
      expect(saveRes.body.tenantId).toBe("TENANT-XYZ");
      expect(saveRes.body.accountingMethod).toBe("cash");

      const getRes = await request(app).get("/api/accounting/tenant-config/TENANT-XYZ");
      expect(getRes.status).toBe(200);
      expect(getRes.body.accountingMethod).toBe("cash");
      expect(getRes.body.costingMethod).toBe("weighted_average_cost");
      expect(getRes.body.currencyCode).toBe("EUR");
    });
  });
});
