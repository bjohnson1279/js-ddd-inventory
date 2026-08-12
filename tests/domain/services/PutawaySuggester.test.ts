import { PutawaySuggester } from "../../../src/domain/services/PutawaySuggester";
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
});
