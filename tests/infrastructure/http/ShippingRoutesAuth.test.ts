process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "dummy_test_secret";
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
import jwt from "jsonwebtoken";

describe("Shipping Routes Authorization", () => {
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

  const generateToken = (role: string) => {
    return jwt.sign({ actorId: "test-user", role, tenantId: "DEFAULT" }, process.env.JWT_SECRET!);
  };

  it("should enforce authorization on GET /api/shipping/rates - 401 without token", async () => {
    const res = await request(app)
      .get("/api/shipping/rates?sku=SHIPPING-SKU-1&quantity=3&address=123+Main+St")
      .set("x-test-enforce-auth", "true");

    expect(res.status).toBe(401);
  });

  it("should enforce authorization on POST /api/shipping/labels - 403 for viewer", async () => {
    const token = generateToken("viewer");
    const res = await request(app)
      .post("/api/shipping/labels")
      .set("Authorization", `Bearer ${token}`)
      .set("x-test-enforce-auth", "true")
      .send({
        sku: "SHIPPING-SKU-1",
        quantity: 3,
        destinationAddress: "123 Main St",
        carrier: "UPS Ground",
        locationId: "default",
        tenantId: "DEFAULT"
      });

    expect(res.status).toBe(403);
  });
});
