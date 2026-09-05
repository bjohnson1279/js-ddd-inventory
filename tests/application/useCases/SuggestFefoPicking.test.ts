import { SuggestFefoPicking } from "../../../src/application/useCases/SuggestFefoPicking";
import { IProductRepository } from "../../../src/domain/repositories/IProductRepository";
import { ICostLayerRepository } from "../../../src/domain/repositories/ICostLayerRepository";
import { Product } from "../../../src/domain/product/aggregates/Product";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryCostLayer } from "../../../src/domain/accounting/entities/InventoryCostLayer";
import { VariantAttribute } from "../../../src/domain/product/valueObjects/VariantAttribute";

describe("SuggestFefoPicking Use Case", () => {
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let mockCostLayerRepo: jest.Mocked<ICostLayerRepository>;
  let useCase: SuggestFefoPicking;

  beforeEach(() => {
    mockProductRepo = {
      findBySku: jest.fn(),
      findBySkus: jest.fn(),
      save: jest.fn(),
    } as any;

    mockCostLayerRepo = {
      getActiveLayers: jest.fn(),
      getActiveLayersByVariantIds: jest.fn(),
      save: jest.fn(),
      saveMany: jest.fn(),
    } as any;

    useCase = new SuggestFefoPicking(mockProductRepo, mockCostLayerRepo);
  });

  it("should throw an error if quantity is less than or equal to zero", async () => {
    await expect(useCase.execute("SKU-1", 0)).rejects.toThrow("Pick quantity must be positive.");
    await expect(useCase.execute("SKU-1", -5)).rejects.toThrow("Pick quantity must be positive.");
  });

  it("should throw an error if product is not found", async () => {
    mockProductRepo.findBySku.mockResolvedValue(null);
    await expect(useCase.execute("SKU-1", 10)).rejects.toThrow("Product variant with SKU SKU-1 not found.");
  });

  it("should throw an error if product variant is not found", async () => {
    const skuStr = "SKU-1";
    const sku = SKU.create(skuStr);
    const product = new Product("prod-1", "Test Product");
    // We didn't add the variant to the product
    mockProductRepo.findBySku.mockResolvedValue(product);

    await expect(useCase.execute(skuStr, 10)).rejects.toThrow(`Product variant with SKU ${skuStr} not found.`);
  });

  it("should throw an error if no lot-controlled inventory layers are found", async () => {
    const skuStr = "SKU-1";
    const sku = SKU.create(skuStr);
    const product = new Product("prod-1", "Test Product");
    const variant = product.addVariant(sku, [new VariantAttribute("color", "red")]);

    mockProductRepo.findBySku.mockResolvedValue(product);

    // Return layers without lot numbers
    const layerWithoutLot = new InventoryCostLayer("layer-1", variant.id, "tenant-1", 10, 100, new Date(), "po-1");
    mockCostLayerRepo.getActiveLayers.mockResolvedValue([layerWithoutLot]);

    await expect(useCase.execute(skuStr, 10)).rejects.toThrow(`No lot-controlled inventory layers found for SKU ${skuStr}.`);
  });

  it("should successfully suggest FEFO picking from a single layer", async () => {
    const skuStr = "SKU-1";
    const sku = SKU.create(skuStr);
    const product = new Product("prod-1", "Test Product");
    const variant = product.addVariant(sku, [new VariantAttribute("color", "red")]);

    mockProductRepo.findBySku.mockResolvedValue(product);

    const expDate = new Date("2024-12-31");
    const layer = new InventoryCostLayer("layer-1", variant.id, "tenant-1", 100, 100, new Date(), "po-1", "loc-1", "LOT-A", expDate);
    mockCostLayerRepo.getActiveLayers.mockResolvedValue([layer]);

    const suggestions = await useCase.execute(skuStr, 10);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toEqual({
      locationId: "loc-1",
      lotNumber: "LOT-A",
      expirationDate: expDate,
      quantity: 10
    });

    expect(mockCostLayerRepo.getActiveLayers).toHaveBeenCalledWith(variant.id, "expiration_date ASC");
  });

  it("should default locationId to 'default' if layer has no locationId", async () => {
    const skuStr = "SKU-1";
    const sku = SKU.create(skuStr);
    const product = new Product("prod-1", "Test Product");
    const variant = product.addVariant(sku, [new VariantAttribute("color", "red")]);

    mockProductRepo.findBySku.mockResolvedValue(product);

    const expDate = new Date("2024-12-31");
    const layer = new InventoryCostLayer("layer-1", variant.id, "tenant-1", 100, 100, new Date(), "po-1", null, "LOT-A", expDate);
    mockCostLayerRepo.getActiveLayers.mockResolvedValue([layer]);

    const suggestions = await useCase.execute(skuStr, 10);

    expect(suggestions[0].locationId).toBe("default");
  });

  it("should successfully suggest FEFO picking across multiple layers", async () => {
    const skuStr = "SKU-1";
    const sku = SKU.create(skuStr);
    const product = new Product("prod-1", "Test Product");
    const variant = product.addVariant(sku, [new VariantAttribute("color", "red")]);

    mockProductRepo.findBySku.mockResolvedValue(product);

    const expDate1 = new Date("2024-10-31");
    const layer1 = new InventoryCostLayer("layer-1", variant.id, "tenant-1", 10, 100, new Date(), "po-1", "loc-1", "LOT-A", expDate1);

    const expDate2 = new Date("2024-11-30");
    const layer2 = new InventoryCostLayer("layer-2", variant.id, "tenant-1", 20, 100, new Date(), "po-2", "loc-2", "LOT-B", expDate2);

    mockCostLayerRepo.getActiveLayers.mockResolvedValue([layer1, layer2]);

    const suggestions = await useCase.execute(skuStr, 25);

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toEqual({
      locationId: "loc-1",
      lotNumber: "LOT-A",
      expirationDate: expDate1,
      quantity: 10
    });
    expect(suggestions[1]).toEqual({
      locationId: "loc-2",
      lotNumber: "LOT-B",
      expirationDate: expDate2,
      quantity: 15
    });
  });

  it("should throw an error if there is insufficient lot-controlled inventory", async () => {
    const skuStr = "SKU-1";
    const sku = SKU.create(skuStr);
    const product = new Product("prod-1", "Test Product");
    const variant = product.addVariant(sku, [new VariantAttribute("color", "red")]);

    mockProductRepo.findBySku.mockResolvedValue(product);

    const expDate = new Date("2024-12-31");
    const layer = new InventoryCostLayer("layer-1", variant.id, "tenant-1", 10, 100, new Date(), "po-1", "loc-1", "LOT-A", expDate);
    mockCostLayerRepo.getActiveLayers.mockResolvedValue([layer]);

    await expect(useCase.execute(skuStr, 25)).rejects.toThrow(
      `Insufficient lot-controlled inventory available to pick 25 units for SKU ${skuStr} (Missing: 15).`
    );
  });

  it("should skip layers with no remaining quantity", async () => {
    const skuStr = "SKU-1";
    const sku = SKU.create(skuStr);
    const product = new Product("prod-1", "Test Product");
    const variant = product.addVariant(sku, [new VariantAttribute("color", "red")]);

    mockProductRepo.findBySku.mockResolvedValue(product);

    const expDate1 = new Date("2024-10-31");
    const layer1 = new InventoryCostLayer("layer-1", variant.id, "tenant-1", 10, 100, new Date(), "po-1", "loc-1", "LOT-A", expDate1);
    layer1.consume(10); // make remaining quantity 0

    const expDate2 = new Date("2024-11-30");
    const layer2 = new InventoryCostLayer("layer-2", variant.id, "tenant-1", 20, 100, new Date(), "po-2", "loc-2", "LOT-B", expDate2);

    mockCostLayerRepo.getActiveLayers.mockResolvedValue([layer1, layer2]);

    const suggestions = await useCase.execute(skuStr, 15);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toEqual({
      locationId: "loc-2",
      lotNumber: "LOT-B",
      expirationDate: expDate2,
      quantity: 15
    });
  });
});
