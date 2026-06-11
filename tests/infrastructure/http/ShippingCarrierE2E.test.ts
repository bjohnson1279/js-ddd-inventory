process.env.NODE_ENV = "test";
process.env.SHOPIFY_API_SECRET = "dummy_test_secret";

import request from "supertest";
import { app, setupApp } from "../../../src/index";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { InMemoryTenantConfigRepository } from "../../../src/infrastructure/database/InMemoryTenantConfigRepository";
import { InMemoryJournalRepository } from "../../../src/infrastructure/database/InMemoryJournalRepository";
import { InMemoryOutboxRepository } from "../../../src/infrastructure/database/InMemoryOutboxRepository";
import { InMemoryDispatchRecordRepository } from "../../../src/infrastructure/database/InMemoryDispatchRecordRepository";
import { InMemoryShipmentRepository } from "../../../src/infrastructure/database/InMemoryShipmentRepository";
import { MockCarrierService } from "../../../src/infrastructure/shipping/MockCarrierService";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { TenantAccountingConfig } from "../../../src/domain/accounting/valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";
import { CostingMethod } from "../../../src/domain/accounting/enums/CostingMethod";
import { ShipmentStatus } from "../../../src/domain/shipping/enums/ShipmentStatus";

describe("Shipping Carrier HTTP API Endpoints", () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let tenantConfigRepo: InMemoryTenantConfigRepository;
  let journalRepo: InMemoryJournalRepository;
  let outboxRepo: InMemoryOutboxRepository;
  let dispatchRecordRepo: InMemoryDispatchRecordRepository;
  let shipmentRepo: InMemoryShipmentRepository;
  let carrierService: MockCarrierService;

  beforeEach(async () => {
    inventoryRepo = new InMemoryInventoryRepository();
    tenantConfigRepo = new InMemoryTenantConfigRepository();
    journalRepo = new InMemoryJournalRepository();
    outboxRepo = new InMemoryOutboxRepository();
    dispatchRecordRepo = new InMemoryDispatchRecordRepository();
    shipmentRepo = new InMemoryShipmentRepository();
    carrierService = new MockCarrierService();

    // Setup tenant configuration for Accrual method
    await tenantConfigRepo.save("DEFAULT", new TenantAccountingConfig(AccountingMethod.Accrual, CostingMethod.FIFO, "USD", "01-01"));

    setupApp(
      inventoryRepo,
      undefined,
      undefined,
      undefined,
      journalRepo,
      tenantConfigRepo,
      undefined,
      outboxRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      dispatchRecordRepo,
      undefined,
      shipmentRepo,
      carrierService
    );
  });

  it("should estimate rates, purchase labels, update inventory levels, post double-entry journals, and track shipments", async () => {
    // 1. Setup item stock
    const sku = "SHIPPING-SKU-1";
    const item = InventoryItem.create("item-1", SKU.create(sku), "default", Quantity.create(25));
    await inventoryRepo.save(item);

    // 2. Fetch rates
    const ratesRes = await request(app)
      .get(`/api/shipping/rates?sku=${sku}&quantity=3&address=1600+Amphitheatre+Pkwy,+Mountain+View,+CA`);

    expect(ratesRes.status).toBe(200);
    expect(ratesRes.body.length).toBe(4); // UPS, FedEx, DHL, USPS
    expect(ratesRes.body[0].carrier).toBe("UPS Ground");
    expect(ratesRes.body[0].rateCents).toBeGreaterThan(0);

    // 3. Purchase shipping label
    const labelRes = await request(app)
      .post("/api/shipping/labels")
      .send({
        sku,
        quantity: 3,
        destinationAddress: "1600 Amphitheatre Pkwy, Mountain View, CA",
        carrier: "UPS Ground",
        locationId: "default",
        tenantId: "DEFAULT"
      });

    expect(labelRes.status).toBe(201);
    expect(labelRes.body.message).toMatch(/success/i);
    expect(labelRes.body.shipmentId).toBeDefined();
    expect(labelRes.body.trackingNumber).toContain("1Z999");
    expect(labelRes.body.labelUrl).toContain("pdf");
    expect(labelRes.body.rateCents).toBeGreaterThan(0);

    const shipmentId = labelRes.body.shipmentId;

    // 4. Verify inventory is decremented
    const updatedItem = await inventoryRepo.findBySku(SKU.create(sku), "default");
    expect(updatedItem?.quantity.getValue()).toBe(22); // 25 - 3 = 22

    // 5. Verify shipment record was saved
    const savedShipment = await shipmentRepo.findById(shipmentId);
    expect(savedShipment).toBeDefined();
    expect(savedShipment?.sku).toBe(sku);
    expect(savedShipment?.status).toBe(ShipmentStatus.LABEL_GENERATED);

    // 6. Verify ledger postings (Debited expense, Credited liabilities)
    const ledger = await journalRepo.findAll();
    expect(ledger.length).toBe(1);
    expect(ledger[0].description).toContain("purchased: UPS Ground");
    
    // Total lines inside journal entry should be 2 (debit and credit)
    expect(ledger[0].lines.length).toBe(2);
    expect(ledger[0].lines[0].account.code).toBe("5400"); // Shipping & Freight Expense
    expect(ledger[0].lines[0].type).toBe("debit");
    expect(ledger[0].lines[1].account.code).toBe("2100"); // Accrued Liabilities
    expect(ledger[0].lines[1].type).toBe("credit");

    // 7. Verify Outbox event generated
    const outboxEvents = await outboxRepo.fetchPending(10);
    expect(outboxEvents.length).toBe(1);
    expect(outboxEvents[0].eventName).toBe("ShipmentCreatedEvent");

    // 8. Track/update shipment status to In Transit
    const trackRes = await request(app)
      .post(`/api/shipping/shipments/${shipmentId}/track`)
      .send({ status: ShipmentStatus.IN_TRANSIT });

    expect(trackRes.status).toBe(200);
    expect(trackRes.body.status).toBe(ShipmentStatus.IN_TRANSIT);

    // Verify status updated in DB
    const finalShipmentStatus = await shipmentRepo.findById(shipmentId);
    expect(finalShipmentStatus?.status).toBe(ShipmentStatus.IN_TRANSIT);

    // Verify subsequent outbox event
    const outboxEvents2 = await outboxRepo.fetchPending(10);
    // 2 events should be pending now (initial creation + status update)
    expect(outboxEvents2.length).toBe(2);
    expect(outboxEvents2[1].eventName).toBe("ShipmentStatusUpdatedEvent");
  });
});
