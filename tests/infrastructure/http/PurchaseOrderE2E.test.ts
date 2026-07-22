process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "dummy_test_secret";
process.env.SHOPIFY_API_SECRET = "dummy_test_secret";

import request from "supertest";
import jwt from "jsonwebtoken";
import { app, setupApp } from "../../../src/index";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { InMemoryPurchaseOrderRepository } from "../../../src/infrastructure/database/InMemoryPurchaseOrderRepository";
import { InMemoryCostLayerRepository } from "../../../src/infrastructure/database/InMemoryCostLayerRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { PurchaseOrderStatus } from "../../../src/domain/procurement/enums/PurchaseOrderStatus";


const getAdminToken = () => {
  const JWT_SECRET = process.env.JWT_SECRET || "dummy_test_secret";
  return jwt.sign({ actorId: "admin-user", role: "admin", tenantId: "tenant-1" }, JWT_SECRET);
};

describe("Purchase Order HTTP API Endpoints", () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let poRepo: InMemoryPurchaseOrderRepository;
  let costLayerRepo: InMemoryCostLayerRepository;

  beforeEach(() => {
    inventoryRepo = new InMemoryInventoryRepository();
    poRepo = new InMemoryPurchaseOrderRepository();
    costLayerRepo = new InMemoryCostLayerRepository();

    setupApp(
      inventoryRepo,
      undefined,
      undefined,
      costLayerRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      poRepo
    );
  });

  it("should complete the full PO lifecycle: Create -> Approve -> Send -> Receive", async () => {
    // 1. Create Purchase Order
    const createRes = await request(app)
      .post("/api/purchase-orders")
        .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        purchaseOrderNumber: "PO-2026",
        vendorId: "vendor-123",
        tenantId: "tenant-ABC",
        locationId: "warehouse-north",
        items: [
          { variantId: "SKU-IPHONE", quantity: 10, unitCostCents: 80000 },
          { variantId: "SKU-IPAD", quantity: 5, unitCostCents: 50000 },
        ],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.purchaseOrderNumber).toBe("PO-2026");
    expect(createRes.body.status).toBe(PurchaseOrderStatus.Draft);
    expect(createRes.body.items.length).toBe(2);

    const poId = createRes.body.id;

    // 2. Approve Purchase Order
    const approveRes = await request(app)
      .post(`/api/purchase-orders/${poId}/approve`).set("Authorization", `Bearer ${getAdminToken()}`);
    
    expect(approveRes.status).toBe(200);

    let po = await poRepo.findById(poId);
    expect(po?.status).toBe(PurchaseOrderStatus.Approved);

    // 3. Send Purchase Order
    const sendRes = await request(app)
      .post(`/api/purchase-orders/${poId}/send`).set("Authorization", `Bearer ${getAdminToken()}`);
    
    expect(sendRes.status).toBe(200);

    po = await poRepo.findById(poId);
    expect(po?.status).toBe(PurchaseOrderStatus.Sent);

    // 4. Receive items
    const receiveRes = await request(app)
      .post(`/api/purchase-orders/${poId}/receive`).set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        items: [
          { variantId: "SKU-IPHONE", quantityReceived: 4 },
          { variantId: "SKU-IPAD", quantityReceived: 5 },
        ],
      });

    expect(receiveRes.status).toBe(200);

    // Verify PO status and item receive counts
    po = await poRepo.findById(poId);
    expect(po?.status).toBe(PurchaseOrderStatus.PartiallyReceived);
    expect(po?.items.find(i => i.variantId === "SKU-IPHONE")?.receivedQuantity).toBe(4);
    expect(po?.items.find(i => i.variantId === "SKU-IPAD")?.receivedQuantity).toBe(5);

    // Verify physical stock levels
    const stockIphone = await inventoryRepo.findBySku(SKU.create("SKU-IPHONE"), "warehouse-north");
    const stockIpad = await inventoryRepo.findBySku(SKU.create("SKU-IPAD"), "warehouse-north");
    expect(stockIphone?.quantity.getValue()).toBe(4);
    expect(stockIpad?.quantity.getValue()).toBe(5);

    // Verify cost layers
    const iphoneLayers = await costLayerRepo.getActiveLayers("SKU-IPHONE");
    expect(iphoneLayers.length).toBe(1);
    expect(iphoneLayers[0].originalQuantity).toBe(4);
    expect(iphoneLayers[0].unitCostCents).toBe(80000);
    expect(iphoneLayers[0].locationId).toBe("warehouse-north");
  });
});
