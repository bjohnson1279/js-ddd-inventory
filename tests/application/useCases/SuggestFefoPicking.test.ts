import { SuggestFefoPicking } from "../../../src/application/useCases/SuggestFefoPicking";
import { IProductRepository } from "../../../src/domain/repositories/IProductRepository";
import { ICostLayerRepository } from "../../../src/domain/repositories/ICostLayerRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Product } from "../../../src/domain/product/aggregates/Product";
import { InventoryCostLayer } from "../../../src/domain/accounting/entities/InventoryCostLayer";
import { VariantAttribute } from "../../../src/domain/product/valueObjects/VariantAttribute";

describe("SuggestFefoPicking", () => {
  let productRepository: jest.Mocked<IProductRepository>;
  let costLayerRepository: jest.Mocked<ICostLayerRepository>;
  let suggestFefoPicking: SuggestFefoPicking;

  beforeEach(() => {
    productRepository = {
      findBySku: jest.fn(),
      findBySkus: jest.fn(),
      save: jest.fn()
    };
    costLayerRepository = {
      getActiveLayers: jest.fn(),
      getActiveLayersByVariantIds: jest.fn(),
      save: jest.fn(),
      saveMany: jest.fn()
    };
    suggestFefoPicking = new SuggestFefoPicking(productRepository, costLayerRepository);
  });

  it("should throw if quantity is <= 0", async () => {
    await expect(suggestFefoPicking.execute("TEST-SKU", 0)).rejects.toThrow("Pick quantity must be positive.");
    await expect(suggestFefoPicking.execute("TEST-SKU", -5)).rejects.toThrow("Pick quantity must be positive.");
  });

  it("should throw if product is not found", async () => {
    productRepository.findBySku.mockResolvedValue(null);
    await expect(suggestFefoPicking.execute("TEST-SKU", 10)).rejects.toThrow("Product variant with SKU TEST-SKU not found.");
  });

  it("should throw if variant is not found in product", async () => {
    const product = new Product("prod-id", "Test Product");
    productRepository.findBySku.mockResolvedValue(product);
    await expect(suggestFefoPicking.execute("TEST-SKU", 10)).rejects.toThrow("Product variant with SKU TEST-SKU not found.");
  });

  it("should throw if no lot-controlled inventory layers found", async () => {
    const product = new Product("prod-id", "Test Product");
    const sku = SKU.create("TEST-SKU");
    product.addVariant(sku, [new VariantAttribute("Color", "Red")]);
    productRepository.findBySku.mockResolvedValue(product);

    costLayerRepository.getActiveLayers.mockResolvedValue([
      new InventoryCostLayer("layer1", "variantId", "tenantId", 10, 100, new Date(), "po1")
    ]);

    await expect(suggestFefoPicking.execute("TEST-SKU", 5)).rejects.toThrow("No lot-controlled inventory layers found for SKU TEST-SKU.");
  });

  it("should return suggestions from a single layer", async () => {
    const product = new Product("prod-id", "Test Product");
    const sku = SKU.create("TEST-SKU");
    const variant = product.addVariant(sku, [new VariantAttribute("Color", "Red")]);
    productRepository.findBySku.mockResolvedValue(product);

    const layer = new InventoryCostLayer("layer1", variant.id, "tenantId", 10, 100, new Date(), "po1", "loc1", "lotA", new Date("2025-12-31"));
    costLayerRepository.getActiveLayers.mockResolvedValue([layer]);

    const result = await suggestFefoPicking.execute("TEST-SKU", 5);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      locationId: "loc1",
      lotNumber: "lotA",
      expirationDate: new Date("2025-12-31"),
      quantity: 5
    });
  });

  it("should return suggestions from multiple layers", async () => {
    const product = new Product("prod-id", "Test Product");
    const sku = SKU.create("TEST-SKU");
    const variant = product.addVariant(sku, [new VariantAttribute("Color", "Red")]);
    productRepository.findBySku.mockResolvedValue(product);

    const layer1 = new InventoryCostLayer("layer1", variant.id, "tenantId", 5, 100, new Date(), "po1", "loc1", "lotA", new Date("2024-12-31"));
    const layer2 = new InventoryCostLayer("layer2", variant.id, "tenantId", 10, 100, new Date(), "po2", "loc2", "lotB", new Date("2025-12-31"));
    costLayerRepository.getActiveLayers.mockResolvedValue([layer1, layer2]);

    const result = await suggestFefoPicking.execute("TEST-SKU", 12);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      locationId: "loc1",
      lotNumber: "lotA",
      expirationDate: new Date("2024-12-31"),
      quantity: 5
    });
    expect(result[1]).toEqual({
      locationId: "loc2",
      lotNumber: "lotB",
      expirationDate: new Date("2025-12-31"),
      quantity: 7
    });
  });

  it("should throw if insufficient lot-controlled inventory available", async () => {
    const product = new Product("prod-id", "Test Product");
    const sku = SKU.create("TEST-SKU");
    const variant = product.addVariant(sku, [new VariantAttribute("Color", "Red")]);
    productRepository.findBySku.mockResolvedValue(product);

    const layer1 = new InventoryCostLayer("layer1", variant.id, "tenantId", 5, 100, new Date(), "po1", "loc1", "lotA", new Date("2024-12-31"));
    costLayerRepository.getActiveLayers.mockResolvedValue([layer1]);

    await expect(suggestFefoPicking.execute("TEST-SKU", 10)).rejects.toThrow("Insufficient lot-controlled inventory available to pick 10 units for SKU TEST-SKU (Missing: 5).");
  });
});
