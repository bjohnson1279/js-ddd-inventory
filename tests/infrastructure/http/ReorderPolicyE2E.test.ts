process.env.NODE_ENV = "test";
process.env.SHOPIFY_API_SECRET = "dummy_test_secret";

import request from "supertest";
import { app, setupApp } from "../../../src/index";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { InMemoryPurchaseOrderRepository } from "../../../src/infrastructure/database/InMemoryPurchaseOrderRepository";
import { InMemoryReorderPolicyRepository } from "../../../src/infrastructure/database/InMemoryReorderPolicyRepository";
import { ReorderPolicyService } from "../../../src/domain/procurement/services/ReorderPolicyService";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";

describe("Reorder Policy HTTP API Endpoints", () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let poRepo: InMemoryPurchaseOrderRepository;
  let policyRepo: InMemoryReorderPolicyRepository;
  let reorderPolicyService: ReorderPolicyService;

  beforeEach(() => {
    inventoryRepo = new InMemoryInventoryRepository();
    poRepo = new InMemoryPurchaseOrderRepository();
    policyRepo = new InMemoryReorderPolicyRepository();
    reorderPolicyService = new ReorderPolicyService(policyRepo, poRepo);

    setupApp(
      inventoryRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      poRepo,
      policyRepo,
      reorderPolicyService
    );
  });

  it("should create, fetch, and trigger auto-reorder during stock dispatch", async () => {
    // 1. Create a Reorder Policy via HTTP POST
    const createRes = await request(app)
      .post("/api/reorder-policies")
      .send({
        sku: "IPHONE-15",
        locationId: "warehouse-south",
        reorderPoint: 5,
        reorderQuantity: 25,
        safetyStock: 2,
      });

    expect(createRes.status).toBe(200);
    expect(createRes.body.sku).toBe("IPHONE-15");
    expect(createRes.body.reorderPoint).toBe(5);

    // 2. Fetch the created policy via HTTP GET
    const getRes = await request(app)
      .get("/api/reorder-policies/IPHONE-15/warehouse-south");

    expect(getRes.status).toBe(200);
    expect(getRes.body.reorderQuantity).toBe(25);

    // 3. Initialize inventory stock level to 10
    const invItem = InventoryItem.create("item-1", SKU.create("IPHONE-15"), "warehouse-south", Quantity.create(10));
    await inventoryRepo.save(invItem);

    // 4. Dispatch 6 items, dropping stock level to 4 (below reorder point of 5)
    const dispatchRes = await request(app)
      .post("/api/inventory/dispatch")
      .send({
        sku: "IPHONE-15",
        amount: 6,
        locationId: "warehouse-south"
      });

    expect(dispatchRes.status).toBe(200);

    // 5. Verify that a draft PO was automatically created by the ReorderPolicyService check
    const pos = await poRepo.findAll();
    expect(pos.length).toBe(1);
    expect(pos[0].purchaseOrderNumber).toContain("AUTO-REORDER-IPHONE-15");
    expect(pos[0].items[0].quantity).toBe(25);
  });
});
