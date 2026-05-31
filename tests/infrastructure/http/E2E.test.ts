process.env.NODE_ENV = "test";

import request from "supertest";
import { app, setupApp } from "../../../src/index";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { prisma } from "../../../src/infrastructure/database/prisma";
import * as crypto from "crypto";

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
      const hmac = crypto.createHmac("sha256", "dummy_secret").update(rawBody, "utf8").digest("base64");

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
      const hmac = crypto.createHmac("sha256", "dummy_secret").update(rawBody, "utf8").digest("base64");

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
