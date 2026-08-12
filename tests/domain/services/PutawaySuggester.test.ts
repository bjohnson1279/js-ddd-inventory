import { PutawaySuggester } from "../../../src/domain/services/PutawaySuggester";
<<<<<<< HEAD
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { ProductVariant } from "../../../src/domain/product/entities/ProductVariant";
import { Product } from "../../../src/domain/product/aggregates/Product";
import { WarehouseLocation } from "../../../src/domain/product/entities/WarehouseLocation";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { LocationId } from "../../../src/domain/valueObjects/LocationId";
import { VariantAttribute } from "../../../src/domain/product/valueObjects/VariantAttribute";
import { VariantAttributeSet } from "../../../src/domain/product/valueObjects/VariantAttributeSet";

describe("PutawaySuggester", () => {
  let mockInventoryRepo: any;
  let mockProductRepo: any;
  let mockLocationRepo: any;
  let suggester: PutawaySuggester;

  beforeEach(() => {
    mockInventoryRepo = {
      findAllByLocationIds: jest.fn(),
      findAll: jest.fn(),
    };
    mockProductRepo = {
      findBySku: jest.fn(),
      findBySkus: jest.fn(),
    };
    mockLocationRepo = {
      findAll: jest.fn(),
    };

    suggester = new PutawaySuggester(
      mockInventoryRepo,
      mockProductRepo,
      mockLocationRepo
    );
  });

  it("should throw error if quantity is not positive", async () => {
    await expect(suggester.suggestPutaway(SKU.create("TEST-SKU"), 0)).rejects.toThrow("Quantity to put away must be positive.");
    await expect(suggester.suggestPutaway(SKU.create("TEST-SKU"), -1)).rejects.toThrow("Quantity to put away must be positive.");
  });

  it("should throw error if product variant not found", async () => {
    mockProductRepo.findBySku.mockResolvedValue(null);
    await expect(suggester.suggestPutaway(SKU.create("TEST-SKU"), 10)).rejects.toThrow("Product variant with SKU TEST-SKU not found.");
  });

  it("should throw error if product found but variant missing (edge case)", async () => {
    const sku = SKU.create("TEST-SKU");
    const product = new Product("PROD-1", "Product");
    mockProductRepo.findBySku.mockResolvedValue(product);
    await expect(suggester.suggestPutaway(sku, 10)).rejects.toThrow("Product variant with SKU TEST-SKU not found.");
  });

  it("should return empty array if no locations exist", async () => {
    const sku = SKU.create("TEST-SKU");
    const product = new Product("PROD-1", "Product");
    product.addVariant(sku, [new VariantAttribute("color", "red")], 100, 0.01);
    mockProductRepo.findBySku.mockResolvedValue(product);
    mockLocationRepo.findAll.mockResolvedValue([]);

    const recommendations = await suggester.suggestPutaway(sku, 10);
    expect(recommendations).toEqual([]);
  });

  it("should suggest putaway locations considering attributes and capacities", async () => {
    const sku = SKU.create("TEST-SKU");
    const product = new Product("PROD-1", "Product");
    const attrs = [
      new VariantAttribute("temperatureZone", "cold"),
      new VariantAttribute("velocity", "fast-moving")
    ];
    product.addVariant(sku, attrs, 100, 0.01); // 100g, 0.01 m^3

    const loc1 = WarehouseLocation.parsePath("WH1-COLD-A01-R01-S01-B01", 1000, 0.1);
    const loc2 = WarehouseLocation.parsePath("WH1-COLD-A02-R01-S01-B01", 500, 0.05);
    const loc3 = WarehouseLocation.parsePath("WH1-DRY-A01-R01-S01-B01", 1000, 0.1); // Mismatched zone

    mockProductRepo.findBySku.mockResolvedValue(product);
    mockProductRepo.findBySkus.mockResolvedValue([product]);
    mockLocationRepo.findAll.mockResolvedValue([loc1, loc2, loc3]);
    mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);

    const recommendations = await suggester.suggestPutaway(sku, 12);

    expect(recommendations.length).toBe(2);
    expect(recommendations[0].locationId).toBe(loc1.id.value); // loc1 has more capacity, scores highest
    expect(recommendations[0].quantity).toBe(10); // 10 units * 0.01 = 0.1 m^3 (max volume)

    expect(recommendations[1].locationId).toBe(loc2.id.value);
    expect(recommendations[1].quantity).toBe(2);
  });

  it("should deduct existing inventory from location capacity", async () => {
    const sku = SKU.create("TEST-SKU");
    const product = new Product("PROD-1", "Product");
    const attrs = [
      new VariantAttribute("color", "blue")
    ];
    const variant = product.addVariant(sku, attrs, 100, 0.01); // 100g, 0.01 m^3

    const loc1 = WarehouseLocation.parsePath("WH1-ZONEA-A01-R01-S01-B01", 1000, 0.1); // can hold 10

    mockProductRepo.findBySku.mockResolvedValue(product);
    mockProductRepo.findBySkus.mockResolvedValue([product]);
    mockLocationRepo.findAll.mockResolvedValue([loc1]);

    const inventoryItem = InventoryItem.create(
      "INV-1",
      sku,
      loc1.id.value,
      Quantity.create(5)
    );
    mockInventoryRepo.findAllByLocationIds.mockResolvedValue([inventoryItem]);

    // Total capacity = 10. Existing = 5. Remaining = 5.
    const recommendations = await suggester.suggestPutaway(sku, 5);

    expect(recommendations.length).toBe(1);
    expect(recommendations[0].locationId).toBe(loc1.id.value);
    expect(recommendations[0].quantity).toBe(5);
  });

  it("should throw error if insufficient capacity across all locations", async () => {
    const sku = SKU.create("TEST-SKU");
    const product = new Product("PROD-1", "Product");
    const attrs = [
      new VariantAttribute("color", "green")
    ];
    product.addVariant(sku, attrs, 100, 0.01);

    const loc1 = WarehouseLocation.parsePath("WH1-ZONEA-A01-R01-S01-B01", 500, 0.05); // can hold 5

    mockProductRepo.findBySku.mockResolvedValue(product);
    mockProductRepo.findBySkus.mockResolvedValue([product]);
    mockLocationRepo.findAll.mockResolvedValue([loc1]);
    mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);

    await expect(suggester.suggestPutaway(sku, 10)).rejects.toThrow(
      "Insufficient warehouse capacity to put away the entire quantity of 10 units for SKU TEST-SKU."
    );
  });

  it("should avoid HAZMAT locations for non-hazard items, and prioritize HAZMAT locations for hazard items", async () => {
    const hazSku = SKU.create("HAZ-SKU");
    const hazProduct = new Product("PROD-HAZ", "Haz Product");
    hazProduct.addVariant(hazSku, [new VariantAttribute("hazardClass", "flammable")], 100, 0.01);

    const normalSku = SKU.create("NORM-SKU");
    const normalProduct = new Product("PROD-NORM", "Normal Product");
    normalProduct.addVariant(normalSku, [new VariantAttribute("color", "black")], 100, 0.01);

    const hazLoc = WarehouseLocation.parsePath("WH1-HAZMAT-A01-R01-S01-B01", 1000, 0.1);
    const normalLoc = WarehouseLocation.parsePath("WH1-DRY-A01-R01-S01-B01", 1000, 0.1);

    mockLocationRepo.findAll.mockResolvedValue([hazLoc, normalLoc]);
    mockInventoryRepo.findAllByLocationIds.mockResolvedValue([]);

    // 1. HAZMAT item should go to HAZMAT zone
    mockProductRepo.findBySku.mockResolvedValue(hazProduct);
    mockProductRepo.findBySkus.mockResolvedValue([hazProduct]);
    const hazRecommendations = await suggester.suggestPutaway(hazSku, 5);
    expect(hazRecommendations.length).toBe(1);
    expect(hazRecommendations[0].locationId).toBe(hazLoc.id.value);

    // 2. Normal item should NOT go to HAZMAT zone
    mockProductRepo.findBySku.mockResolvedValue(normalProduct);
    mockProductRepo.findBySkus.mockResolvedValue([normalProduct]);
    const normalRecommendations = await suggester.suggestPutaway(normalSku, 5);
    expect(normalRecommendations.length).toBe(1);
    expect(normalRecommendations[0].locationId).toBe(normalLoc.id.value);
  });

  it("should use fallback findAll logic if findAllByLocationIds is not implemented", async () => {
    // Remove the method to test fallback
    mockInventoryRepo.findAllByLocationIds = undefined;

    const sku = SKU.create("TEST-SKU");
    const product = new Product("PROD-1", "Product");
    const attrs = [
      new VariantAttribute("color", "yellow")
    ];
    product.addVariant(sku, attrs, 100, 0.01);

    const loc1 = WarehouseLocation.parsePath("WH1-ZONEA-A01-R01-S01-B01", 1000, 0.1);

    mockProductRepo.findBySku.mockResolvedValue(product);
    mockProductRepo.findBySkus.mockResolvedValue([product]);
    mockLocationRepo.findAll.mockResolvedValue([loc1]);
    mockInventoryRepo.findAll.mockResolvedValue([]);

    const recommendations = await suggester.suggestPutaway(sku, 5);
    expect(recommendations.length).toBe(1);
    expect(mockInventoryRepo.findAll).toHaveBeenCalled();
  });
=======
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { InMemoryProductRepository } from "../../../src/infrastructure/database/InMemoryProductRepository";
import { InMemoryWarehouseLocationRepository } from "../../../src/infrastructure/database/InMemoryWarehouseLocationRepository";
import { Product } from "../../../src/domain/product/aggregates/Product";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { WarehouseLocation } from "../../../src/domain/product/entities/WarehouseLocation";
import { VariantAttribute } from "../../../src/domain/product/valueObjects/VariantAttribute";

describe("PutawaySuggester", () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let productRepo: InMemoryProductRepository;
  let locationRepo: InMemoryWarehouseLocationRepository;
  let suggester: PutawaySuggester;

  beforeEach(() => {
    inventoryRepo = new InMemoryInventoryRepository();
    productRepo = new InMemoryProductRepository();
    locationRepo = new InMemoryWarehouseLocationRepository();
    suggester = new PutawaySuggester(inventoryRepo, productRepo, locationRepo);
  });

  const stdAttr = new VariantAttribute("size", "L");
  const hazmatAttr = new VariantAttribute("hazardClass", "flammable");

  it("should throw an error if quantity is not positive", async () => {
    await expect(suggester.suggestPutaway(SKU.create("SKU-1"), 0)).rejects.toThrow("Quantity to put away must be positive.");
    await expect(suggester.suggestPutaway(SKU.create("SKU-1"), -5)).rejects.toThrow("Quantity to put away must be positive.");
  });

  it("should throw an error if product is not found", async () => {
    await expect(suggester.suggestPutaway(SKU.create("NON-EXISTENT"), 10)).rejects.toThrow("Product variant with SKU NON-EXISTENT not found.");
  });

  it("should throw an error if variant is not found in the product", async () => {
    const mockProductRepo = {
      findBySku: jest.fn().mockResolvedValue(new Product("P1", "Product 1")),
      findBySkus: jest.fn(),
      save: jest.fn()
    };

    const suggester2 = new PutawaySuggester(inventoryRepo, mockProductRepo as any, locationRepo);
    await expect(suggester2.suggestPutaway(SKU.create("SKU-NO-VARIANT"), 10)).rejects.toThrow("Product variant with SKU SKU-NO-VARIANT not found.");
  });

  it("should return empty array if there are no locations", async () => {
    const product = new Product("P1", "Product 1");
    product.addVariant(SKU.create("SKU-1"), [stdAttr]);
    await productRepo.save(product);

    const recommendations = await suggester.suggestPutaway(SKU.create("SKU-1"), 10);
    expect(recommendations).toEqual([]);
  });

  it("should recommend standard allocation", async () => {
    const product = new Product("P1", "Product 1");
    product.addVariant(SKU.create("SKU-1"), [stdAttr], 1000, 0.01); // 1kg, 0.01m3
    await productRepo.save(product);

    const loc1 = WarehouseLocation.parsePath("WH1-Standard-A01-R1-S1-B1", 10000, 1.0); // Can hold 10
    const loc2 = WarehouseLocation.parsePath("WH1-Standard-A02-R1-S1-B1", 20000, 2.0); // Can hold 20
    await locationRepo.save(loc1);
    await locationRepo.save(loc2);

    const recommendations = await suggester.suggestPutaway(SKU.create("SKU-1"), 15);

    expect(recommendations.length).toBe(1);
    // Highest capacity (loc2) is chosen first
    expect(recommendations[0].locationId).toBe("WH1-Standard-A02-R1-S1-B1");
    expect(recommendations[0].quantity).toBe(15);
  });

  it("should prioritize locations with matching temperature zone and HAZMAT requirements", async () => {
    const product = new Product("P1", "Product 1");
    product.addVariant(SKU.create("SKU-1"), [hazmatAttr], 1000, 0.01);
    await productRepo.save(product);

    const loc1 = WarehouseLocation.parsePath("WH1-Standard-A01-R1-S1-B1", 10000, 1.0);
    const loc2 = WarehouseLocation.parsePath("WH1-Hazmat-A01-R1-S1-B1", 10000, 1.0);
    await locationRepo.save(loc1);
    await locationRepo.save(loc2);

    const recommendations = await suggester.suggestPutaway(SKU.create("SKU-1"), 5);

    expect(recommendations.length).toBe(1);
    expect(recommendations[0].locationId).toBe("WH1-Hazmat-A01-R1-S1-B1");
    expect(recommendations[0].quantity).toBe(5);
  });

  it("should throw error if insufficient capacity for total quantity", async () => {
    const product = new Product("P1", "Product 1");
    product.addVariant(SKU.create("SKU-1"), [stdAttr], 1000, 0.01);
    await productRepo.save(product);

    const loc1 = WarehouseLocation.parsePath("WH1-Standard-A01-R1-S1-B1", 10000, 1.0); // Can hold 10
    await locationRepo.save(loc1);

    await expect(suggester.suggestPutaway(SKU.create("SKU-1"), 15)).rejects.toThrow(
      "Insufficient warehouse capacity to put away the entire quantity of 15 units for SKU SKU-1."
    );
  });
>>>>>>> origin/main
});
