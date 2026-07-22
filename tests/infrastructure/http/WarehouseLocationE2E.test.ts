process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "dummy_test_secret";
process.env.SHOPIFY_API_SECRET = "dummy_test_secret";

import request from "supertest";
import jwt from "jsonwebtoken";
import { app, setupApp } from "../../../src/index";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { InMemoryProductRepository } from "../../../src/infrastructure/database/InMemoryProductRepository";
import { InMemoryWarehouseLocationRepository } from "../../../src/infrastructure/database/InMemoryWarehouseLocationRepository";
import { Product } from "../../../src/domain/product/aggregates/Product";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { VariantAttribute } from "../../../src/domain/product/valueObjects/VariantAttribute";
import { WarehouseLocation } from "../../../src/domain/product/entities/WarehouseLocation";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";

const JWT_SECRET = process.env.JWT_SECRET || "dummy_test_secret";


const getAdminToken = () => {
  const JWT_SECRET = process.env.JWT_SECRET || "dummy_test_secret";
  return jwt.sign({ actorId: "admin-user", role: "admin", tenantId: "tenant-1" }, JWT_SECRET);
};

describe("Warehouse Location WMS Routing & Bins E2E Tests", () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let productRepo: InMemoryProductRepository;
  let locationRepo: InMemoryWarehouseLocationRepository;
  let adminToken: string;
  let viewerToken: string;

  beforeEach(() => {
    inventoryRepo = new InMemoryInventoryRepository();
    productRepo = new InMemoryProductRepository();
    locationRepo = new InMemoryWarehouseLocationRepository();

    setupApp(
      inventoryRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      locationRepo,
      productRepo
    );

    adminToken = jwt.sign({ actorId: "admin-user", role: "admin", tenantId: "tenant-1" }, JWT_SECRET);
    viewerToken = jwt.sign({ actorId: "viewer-user", role: "viewer", tenantId: "tenant-1" }, JWT_SECRET);
  });

  describe("Role Enforcement / RBAC", () => {
    it("should deny viewer from saving a location", async () => {
      const res = await request(app)
        .post("/api/warehouse-locations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({
          path: "WH1-ZONEA-A01-R01-S01-B01",
          maxWeightGrams: 50000,
          maxVolumeCubicMeters: 2.0
        });

      expect(res.status).toBe(403);
    });

    it("should deny viewer from deleting a location", async () => {
      const res = await request(app)
        .delete("/api/warehouse-locations/WH1-ZONEA-A01-R01-S01-B01")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });

    it("should allow admin to save and list locations", async () => {
      const saveRes = await request(app)
        .post("/api/warehouse-locations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          path: "WH1-ZONEA-A01-R01-S01-B01",
          maxWeightGrams: 50000,
          maxVolumeCubicMeters: 2.0
        });

      expect(saveRes.status).toBe(200);

      const listRes = await request(app)
        .get("/api/warehouse-locations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .set("Authorization", `Bearer ${viewerToken}`); // listing is read-only, allowed for viewer

      expect(listRes.status).toBe(200);
      expect(listRes.body.length).toBe(1);
      expect(listRes.body[0].id).toBe("WH1-ZONEA-A01-R01-S01-B01");
    });
  });

  describe("CRUD Actions", () => {
    it("should create, list, and delete a warehouse location successfully", async () => {
      const createRes = await request(app)
        .post("/api/warehouse-locations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          warehouseId: "WH1",
          zone: "ZONEB",
          aisle: "A02",
          rack: "R03",
          shelf: "S04",
          bin: "B05",
          maxWeightGrams: 10000,
          maxVolumeCubicMeters: 1.5
        });

      expect(createRes.status).toBe(200);
      expect(createRes.body.location.id).toBe("WH1-ZONEB-A02-R03-S04-B05");

      const listRes = await request(app)
        .get("/api/warehouse-locations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(listRes.body.length).toBe(1);

      const deleteRes = await request(app)
        .delete("/api/warehouse-locations/WH1-ZONEB-A02-R03-S04-B05")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);

      const listRes2 = await request(app)
        .get("/api/warehouse-locations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(listRes2.body.length).toBe(0);
    });
  });

  describe("WMS Capacity Constraints Validation", () => {
    beforeEach(async () => {
      const loc = WarehouseLocation.parsePath("WH1-ZONEA-A01-R01-S01-B01", 10000, 2.0);
      await locationRepo.save(loc);

      const prod = new Product("PROD-1", "Classic Tee");
      prod.addVariant(SKU.create("TSHIRT-SM-RED"), [new VariantAttribute("color", "red")], 100, 0.05); // 100g, 0.05 m3
      await productRepo.save(prod);
    });

    it("should allow receipt of stock that fits capacity limits", async () => {
      const res = await request(app)
        .post("/api/inventory/receive")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          sku: "TSHIRT-SM-RED",
          amount: 30,
          locationId: "WH1-ZONEA-A01-R01-S01-B01"
        });

      expect(res.status).toBe(200);

      const item = await inventoryRepo.findBySku(SKU.create("TSHIRT-SM-RED"), "WH1-ZONEA-A01-R01-S01-B01");
      expect(item?.quantity.getValue()).toBe(30);
    });

    it("should reject receipt of stock that exceeds weight limit", async () => {
      const res = await request(app)
        .post("/api/inventory/receive")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          sku: "TSHIRT-SM-RED",
          amount: 150, // 150 * 100g = 15000g > 10000g limit
          locationId: "WH1-ZONEA-A01-R01-S01-B01"
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("A domain error occurred");
    });

    it("should reject receipt of stock that exceeds volume limit", async () => {
      const res = await request(app)
        .post("/api/inventory/receive")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          sku: "TSHIRT-SM-RED",
          amount: 60, // 60 * 0.05 m3 = 3.0 m3 > 2.0 m3 limit
          locationId: "WH1-ZONEA-A01-R01-S01-B01"
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("A domain error occurred");
    });
  });

  describe("Putaway Suggestions", () => {
    beforeEach(async () => {
      // Create locations
      // Fast zone
      await locationRepo.save(WarehouseLocation.parsePath("WH1-FAST-A01-R01-S01-B01", 100000, 10.0));
      // Hazmat zone
      await locationRepo.save(WarehouseLocation.parsePath("WH1-HAZMAT-A05-R01-S01-B01", 100000, 10.0));
      // Normal/Cold zone
      await locationRepo.save(WarehouseLocation.parsePath("WH1-COLD-A02-R01-S01-B01", 100000, 10.0));

      // Create products
      const p1 = new Product("P1", "Fast Product");
      p1.addVariant(SKU.create("FAST-SKU"), [new VariantAttribute("velocity", "fast-moving")], 100, 0.01);
      await productRepo.save(p1);

      const p2 = new Product("P2", "Hazmat Product");
      p2.addVariant(SKU.create("HAZ-SKU"), [new VariantAttribute("hazardClass", "flammable")], 200, 0.02);
      await productRepo.save(p2);

      const p3 = new Product("P3", "Cold Product");
      p3.addVariant(SKU.create("COLD-SKU"), [new VariantAttribute("temperatureZone", "cold")], 150, 0.015);
      await productRepo.save(p3);
    });

    it("should recommend fast-moving zone and front aisle for fast SKU", async () => {
      const res = await request(app)
        .post("/api/warehouse-locations/putaway-suggestions")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ sku: "FAST-SKU", quantity: 10 });

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].locationId).toBe("WH1-FAST-A01-R01-S01-B01");
    });

    it("should recommend hazmat zone for hazmat SKU", async () => {
      const res = await request(app)
        .post("/api/warehouse-locations/putaway-suggestions")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ sku: "HA-SKU", quantity: 5 }).send({ sku: "HAZ-SKU", quantity: 5 });

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].locationId).toBe("WH1-HAZMAT-A05-R01-S01-B01");
    });

    it("should recommend cold zone for cold SKU", async () => {
      const res = await request(app)
        .post("/api/warehouse-locations/putaway-suggestions")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ sku: "COLD-SKU", quantity: 8 });

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].locationId).toBe("WH1-COLD-A02-R01-S01-B01");
    });
  });

  describe("Serpentine Picking Route Optimization", () => {
    beforeEach(async () => {
      await locationRepo.save(WarehouseLocation.parsePath("WH1-ZONEA-A01-R01-S01-B01", 100000, 10));
      await locationRepo.save(WarehouseLocation.parsePath("WH1-ZONEA-A01-R02-S01-B01", 100000, 10));
      await locationRepo.save(WarehouseLocation.parsePath("WH1-ZONEA-A02-R01-S01-B01", 100000, 10));
      await locationRepo.save(WarehouseLocation.parsePath("WH1-ZONEA-A02-R02-S01-B01", 100000, 10));
    });

    it("should sort pick list in serpentine (S-shape) order", async () => {
      const items = [
        { sku: "SKU1", quantity: 2, locationId: "WH1-ZONEA-A02-R01-S01-B01" },
        { sku: "SKU2", quantity: 1, locationId: "WH1-ZONEA-A01-R02-S01-B01" },
        { sku: "SKU3", quantity: 5, locationId: "WH1-ZONEA-A01-R01-S01-B01" },
        { sku: "SKU4", quantity: 3, locationId: "WH1-ZONEA-A02-R02-S01-B01" }
      ];

      const res = await request(app)
        .post("/api/warehouse-locations/optimize-pick-route")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ items });

      expect(res.status).toBe(200);
      const optimized = res.body[0].items;

      // Aisle 1 (odd) => rack ascending: R01 then R02
      expect(optimized[0].sku).toBe("SKU3"); // A01-R01
      expect(optimized[1].sku).toBe("SKU2"); // A01-R02

      // Aisle 2 (even) => rack descending: R02 then R01
      expect(optimized[2].sku).toBe("SKU4"); // A02-R02
      expect(optimized[3].sku).toBe("SKU1"); // A02-R01
    });
  });
});
