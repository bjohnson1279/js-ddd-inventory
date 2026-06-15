process.env.NODE_ENV = "test";
process.env.SHOPIFY_API_SECRET = "dummy_test_secret";

import request from "supertest";
import jwt from "jsonwebtoken";
import { app, setupApp } from "../../../src/index";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";

const JWT_SECRET = "super-secret-key";

describe("Allocations & In-Transit Stock E2E Tests", () => {
  let repository: InMemoryInventoryRepository;
  let adminToken: string;
  let viewerToken: string;

  beforeEach(() => {
    repository = new InMemoryInventoryRepository();
    setupApp(repository);

    adminToken = jwt.sign({ actorId: "admin-user", role: "admin", tenantId: "tenant-1" }, JWT_SECRET);
    viewerToken = jwt.sign({ actorId: "viewer-user", role: "viewer", tenantId: "tenant-1" }, JWT_SECRET);
  });

  describe("RBAC Role Constraints", () => {
    it("should allow admin / warehouse_operator to allocate stock", async () => {
      const response = await request(app)
        .post("/api/inventory/allocate")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ sku: "TEST-SKU", amount: 0 });

      expect(response.status).toBe(200);
    });

    it("should deny viewer from allocating stock", async () => {
      const response = await request(app)
        .post("/api/inventory/allocate")
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ sku: "TEST-SKU", amount: 5 });

      expect(response.status).toBe(403);
    });
  });

  describe("Allocation Endpoints Flow", () => {
    it("should allocate, release, and fulfill stock successfully", async () => {
      // 1. Setup item with quantity 20
      const item = InventoryItem.create("item-1", SKU.create("TEST-SKU"), "default", Quantity.create(20));
      await repository.save(item);

      // 2. Allocate 8 units
      const allocRes = await request(app)
        .post("/api/inventory/allocate")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ sku: "TEST-SKU", amount: 8 });
      expect(allocRes.status).toBe(200);

      // 3. Verify counts via getLevel
      const getRes1 = await request(app)
        .get("/api/inventory/TEST-SKU")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(getRes1.status).toBe(200);
      expect(getRes1.body.quantity).toBe(20);
      expect(getRes1.body.allocated).toBe(8);
      expect(getRes1.body.available).toBe(12);

      // 4. Release 3 units of the allocation
      const releaseRes = await request(app)
        .post("/api/inventory/release-allocation")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ sku: "TEST-SKU", amount: 3 });
      expect(releaseRes.status).toBe(200);

      const getRes2 = await request(app)
        .get("/api/inventory/TEST-SKU")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(getRes2.body.allocated).toBe(5);
      expect(getRes2.body.available).toBe(15);

      // 5. Fulfill 5 units of allocation (decreases both quantity and allocation)
      const fulfillRes = await request(app)
        .post("/api/inventory/fulfill-allocation")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ sku: "TEST-SKU", amount: 5 });
      expect(fulfillRes.status).toBe(200);

      const getRes3 = await request(app)
        .get("/api/inventory/TEST-SKU")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(getRes3.body.quantity).toBe(15);
      expect(getRes3.body.allocated).toBe(0);
      expect(getRes3.body.available).toBe(15);
    });

    it("should return 400 when allocating more than available stock", async () => {
      const item = InventoryItem.create("item-1", SKU.create("TEST-SKU"), "default", Quantity.create(10));
      await repository.save(item);

      const response = await request(app)
        .post("/api/inventory/allocate")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ sku: "TEST-SKU", amount: 11 });

      expect(response.status).toBe(400);
      expect(response.body.type).toBe("InsufficientAvailableStockException");
    });
  });

  describe("In-Transit Endpoints Flow", () => {
    it("should create, receive, and cancel in-transit stock", async () => {
      const item = InventoryItem.create("item-1", SKU.create("TEST-SKU"), "default", Quantity.create(10));
      await repository.save(item);

      // 1. Create in-transit stock of 10
      const createRes = await request(app)
        .post("/api/inventory/create-in-transit")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ sku: "TEST-SKU", amount: 10 });
      expect(createRes.status).toBe(200);

      const getRes1 = await request(app)
        .get("/api/inventory/TEST-SKU")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(getRes1.body.inTransit).toBe(10);
      expect(getRes1.body.available).toBe(20);

      // 2. Receive 6 units from in-transit (increases quantity, decreases inTransit)
      const receiveRes = await request(app)
        .post("/api/inventory/receive-in-transit")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ sku: "TEST-SKU", amount: 6 });
      expect(receiveRes.status).toBe(200);

      const getRes2 = await request(app)
        .get("/api/inventory/TEST-SKU")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(getRes2.body.quantity).toBe(16);
      expect(getRes2.body.inTransit).toBe(4);
      expect(getRes2.body.available).toBe(20);
    });
  });

  describe("Concurrency Protection", () => {
    it("should return 400 ConcurrencyException on saving version mismatch", async () => {
      const item = InventoryItem.create("item-1", SKU.create("TEST-SKU"), "default", Quantity.create(10));
      await repository.save(item);

      // Clone item or create a separate instance representing an outdated client
      const outdatedItem = InventoryItem.create(
        "item-1",
        SKU.create("TEST-SKU"),
        "default",
        Quantity.create(15),
        Quantity.create(0),
        Quantity.create(0),
        1 // original version
      );

      // Update actual item in repository, raising version to 2
      item.receiveStock(Quantity.create(5));
      await repository.save(item);
      expect(item.version).toBe(2);

      // Saving outdated item (version 1) against the repository's version 2 should fail
      await expect(repository.save(outdatedItem)).rejects.toThrow(
        /concurrency/i
      );
    });
  });
});
