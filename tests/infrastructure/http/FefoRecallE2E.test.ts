process.env.NODE_ENV = "test";
process.env.SHOPIFY_API_SECRET = "dummy_test_secret";
process.env.JWT_SECRET = "dummy_jwt_secret";

import request from "supertest";
import { app, setupApp } from "../../../src/index";
import { PrismaInventoryRepository } from "../../../src/infrastructure/database/PrismaInventoryRepository";
import { PrismaBarcodeRepository } from "../../../src/infrastructure/database/PrismaBarcodeRepository";
import { PrismaCostLayerRepository } from "../../../src/infrastructure/database/PrismaCostLayerRepository";
import { PrismaDispatchRecordRepository } from "../../../src/infrastructure/database/PrismaDispatchRecordRepository";
import { PrismaProductRepository } from "../../../src/infrastructure/database/PrismaProductRepository";
import { prisma } from "../../../src/infrastructure/database/prisma";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Product } from "../../../src/domain/product/aggregates/Product";
import { VariantAttribute } from "../../../src/domain/product/valueObjects/VariantAttribute";

describe("FEFO and Recall E2E Integration Tests", () => {
  let inventoryRepository: PrismaInventoryRepository;
  let barcodeRepository: PrismaBarcodeRepository;
  let costLayerRepository: PrismaCostLayerRepository;
  let dispatchRecordRepository: PrismaDispatchRecordRepository;
  let productRepository: PrismaProductRepository;

  beforeEach(async () => {
    // Clean database tables before each test
    await prisma.statusTransitionModel.deleteMany();
    await prisma.serializedItemModel.deleteMany();
    await prisma.barcodeAssignmentModel.deleteMany();
    await prisma.inventoryCostLayerModel.deleteMany();
    await prisma.journalLineModel.deleteMany();
    await prisma.journalEntryModel.deleteMany();
    await prisma.kitComponentModel.deleteMany();
    await prisma.kitModel.deleteMany();
    await prisma.dispatchRecordModel.deleteMany();
    await prisma.inventoryModel.deleteMany();
    await prisma.productVariantModel.deleteMany();
    await prisma.productModel.deleteMany();

    inventoryRepository = new PrismaInventoryRepository();
    barcodeRepository = new PrismaBarcodeRepository();
    costLayerRepository = new PrismaCostLayerRepository();
    dispatchRecordRepository = new PrismaDispatchRecordRepository();
    productRepository = new PrismaProductRepository();

    setupApp(
      inventoryRepository,
      barcodeRepository,
      undefined,
      costLayerRepository,
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
      dispatchRecordRepository,
      undefined,
      undefined,
      undefined,
      undefined,
      productRepository
    );
  });

  it("should suggest FEFO picking and trace product recall", async () => {
    // 1. Create a product and product variant
    const product = new Product("prod-fefo", "Fefo Product");
    const skuStr = "FEFO-TEST-SKU";
    product.addVariant(SKU.create(skuStr), [new VariantAttribute("size", "M")], 100, 0.1);
    await productRepository.save(product);

    // 2. Receive stock for three different lots with different expiry dates:
    // Lot A: expires in 10 days
    // Lot B: expires in 5 days (should be picked first!)
    // Lot C: expires in 20 days
    const now = new Date();
    const expiryA = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const expiryB = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const expiryC = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);

    // Receive Lot A: 10 units
    await request(app)
      .post("/api/inventory/receive")
      .send({
        sku: skuStr,
        amount: 10,
        locationId: "loc-1",
        unitCostCents: 100,
        lotNumber: "LOT-A",
        expirationDate: expiryA.toISOString()
      });

    // Receive Lot B: 15 units
    await request(app)
      .post("/api/inventory/receive")
      .send({
        sku: skuStr,
        amount: 15,
        locationId: "loc-1",
        unitCostCents: 110,
        lotNumber: "LOT-B",
        expirationDate: expiryB.toISOString()
      });

    // Receive Lot C: 20 units
    await request(app)
      .post("/api/inventory/receive")
      .send({
        sku: skuStr,
        amount: 20,
        locationId: "loc-1",
        unitCostCents: 120,
        lotNumber: "LOT-C",
        expirationDate: expiryC.toISOString()
      });

    // 3. Request FEFO picking suggestions for 20 units
    // Expected pick:
    // First 15 units from Lot B (expires first)
    // Remaining 5 units from Lot A (expires next)
    const pickResponse = await request(app)
      .get("/api/inventory/fefo-pick")
      .query({ sku: skuStr, quantity: 20 });

    expect(pickResponse.status).toBe(200);
    expect(pickResponse.body.length).toBe(2);
    expect(pickResponse.body[0].lotNumber).toBe("LOT-B");
    expect(pickResponse.body[0].quantity).toBe(15);
    expect(pickResponse.body[1].lotNumber).toBe("LOT-A");
    expect(pickResponse.body[1].quantity).toBe(5);

    // 4. Dispatch stock of 20 units without specifying lot (uses FEFO auto-selection)
    const dispatchResponse = await request(app)
      .post("/api/inventory/dispatch")
      .send({
        sku: skuStr,
        amount: 20,
        locationId: "loc-1"
      });

    expect(dispatchResponse.status).toBe(200);

    // 5. Trace product recall for Lot B
    // We expect 1 contaminated dispatch of 15 units of Lot B
    const recallResponse = await request(app)
      .get("/api/inventory/reports/recall/LOT-B");

    expect(recallResponse.status).toBe(200);
    expect(recallResponse.body.length).toBe(1);
    expect(recallResponse.body[0].lotNumber).toBe("LOT-B");
    expect(recallResponse.body[0].quantity).toBe(15);
    expect(recallResponse.body[0].locationId).toBe("loc-1");
  });
});
