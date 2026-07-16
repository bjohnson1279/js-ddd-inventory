import { WMSCapacityService } from "../../../src/domain/services/WMSCapacityService";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { IProductRepository } from "../../../src/domain/repositories/IProductRepository";
import { IWarehouseLocationRepository } from "../../../src/domain/repositories/IWarehouseLocationRepository";
import { LocationId } from "../../../src/domain/valueObjects/LocationId";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { WarehouseLocation } from "../../../src/domain/product/entities/WarehouseLocation";
import { Product } from "../../../src/domain/product/aggregates/Product";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { CapacityExceededException } from "../../../src/domain/exceptions/CapacityExceededException";
import { VariantAttribute } from "../../../src/domain/product/valueObjects/VariantAttribute";

describe("WMSCapacityService", () => {
  let inventoryRepository: jest.Mocked<IInventoryRepository>;
  let productRepository: jest.Mocked<IProductRepository>;
  let locationRepository: jest.Mocked<IWarehouseLocationRepository>;
  let wmsCapacityService: WMSCapacityService;

  beforeEach(() => {
    inventoryRepository = {
      findBySku: jest.fn(),
      findAllBySku: jest.fn(),
      findBySkus: jest.fn(),
      findAll: jest.fn(),
      findAllByLocation: jest.fn(),
      save: jest.fn(),
      saveMany: jest.fn(),
      hasAnyEntries: jest.fn(),
      hasConflicts: jest.fn(),
    } as unknown as jest.Mocked<IInventoryRepository>;

    productRepository = {
      findBySku: jest.fn(),
      findBySkus: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<IProductRepository>;

    locationRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<IWarehouseLocationRepository>;

    wmsCapacityService = new WMSCapacityService(
      inventoryRepository,
      productRepository,
      locationRepository
    );
  });

  const locationIdStr = "WH1-ZONEA-A03-R02-S01-B10";

  it("should resolve immediately if location does not exist in the repository", async () => {
    locationRepository.findById.mockResolvedValue(null);

    await expect(
      wmsCapacityService.validateCapacity(locationIdStr, [
        { sku: "SKU-1", mode: "absolute", quantity: 100 },
      ])
    ).resolves.toBeUndefined();

    expect(inventoryRepository.findAllByLocation).not.toHaveBeenCalled();
  });

  it("should allow adjustments that do not exceed the weight or volume limits", async () => {
    const location = WarehouseLocation.parsePath(locationIdStr, 1000, 10);
    locationRepository.findById.mockResolvedValue(location);

    inventoryRepository.findAllByLocation.mockResolvedValue([
      InventoryItem.create("item-1", SKU.create("SKU-1"), locationIdStr, Quantity.create(5)),
    ]);

    const product = new Product("prod-1", "Product 1");
    const attr1 = new VariantAttribute("color", "red");
    const attr2 = new VariantAttribute("color", "blue");
    product.addVariant(SKU.create("SKU-1"), [attr1], 100, 1);
    product.addVariant(SKU.create("SKU-2"), [attr2], 200, 2);

    productRepository.findBySkus.mockResolvedValue([product]);

    await expect(
      wmsCapacityService.validateCapacity(locationIdStr, [
        { sku: "SKU-1", mode: "relative", quantity: 2 }, // Total qty for SKU-1: 7 (weight: 700, vol: 7)
        { sku: "SKU-2", mode: "absolute", quantity: 1 }, // Total qty for SKU-2: 1 (weight: 200, vol: 2)
      ])
    ).resolves.toBeUndefined();
    // Total weight: 900 (limit 1000), Total volume: 9 (limit 10)
  });

  it("should resolve without throwing if no active SKUs remain after adjustments", async () => {
    const location = WarehouseLocation.parsePath(locationIdStr, 1000, 10);
    locationRepository.findById.mockResolvedValue(location);

    inventoryRepository.findAllByLocation.mockResolvedValue([
      InventoryItem.create("item-1", SKU.create("SKU-1"), locationIdStr, Quantity.create(5)),
    ]);

    await expect(
      wmsCapacityService.validateCapacity(locationIdStr, [
        { sku: "SKU-1", mode: "absolute", quantity: 0 },
        { sku: "SKU-2", mode: "relative", quantity: 0 },
      ])
    ).resolves.toBeUndefined();

    expect(productRepository.findBySkus).not.toHaveBeenCalled();
  });

  it("should ignore unknown SKUs (variants not found in the product repository) without throwing", async () => {
    const location = WarehouseLocation.parsePath(locationIdStr, 1000, 10);
    locationRepository.findById.mockResolvedValue(location);

    inventoryRepository.findAllByLocation.mockResolvedValue([]);

    const product = new Product("prod-1", "Product 1");
    const attr1 = new VariantAttribute("color", "red");
    // Product has SKU-1 but no SKU-2
    product.addVariant(SKU.create("SKU-1"), [attr1], 100, 1);
    productRepository.findBySkus.mockResolvedValue([product]);

    await expect(
      wmsCapacityService.validateCapacity(locationIdStr, [
        { sku: "SKU-1", mode: "absolute", quantity: 5 }, // weight: 500, vol: 5
        { sku: "SKU-2", mode: "absolute", quantity: 50 }, // Unknown SKU, should be ignored
      ])
    ).resolves.toBeUndefined();
  });

  it("should throw CapacityExceededException when the weight limit is exceeded", async () => {
    const location = WarehouseLocation.parsePath(locationIdStr, 1000, 10);
    locationRepository.findById.mockResolvedValue(location);

    inventoryRepository.findAllByLocation.mockResolvedValue([]);

    const product = new Product("prod-1", "Product 1");
    const attr1 = new VariantAttribute("color", "red");
    product.addVariant(SKU.create("SKU-1"), [attr1], 150, 1);
    productRepository.findBySkus.mockResolvedValue([product]);

    await expect(
      wmsCapacityService.validateCapacity(locationIdStr, [
        { sku: "SKU-1", mode: "absolute", quantity: 10 }, // weight: 1500 (limit 1000)
      ])
    ).rejects.toThrow(CapacityExceededException);
  });

  it("should throw CapacityExceededException when the volume limit is exceeded", async () => {
    const location = WarehouseLocation.parsePath(locationIdStr, 1000, 10);
    locationRepository.findById.mockResolvedValue(location);

    inventoryRepository.findAllByLocation.mockResolvedValue([]);

    const product = new Product("prod-1", "Product 1");
    const attr1 = new VariantAttribute("color", "red");
    product.addVariant(SKU.create("SKU-1"), [attr1], 10, 2);
    productRepository.findBySkus.mockResolvedValue([product]);

    await expect(
      wmsCapacityService.validateCapacity(locationIdStr, [
        { sku: "SKU-1", mode: "absolute", quantity: 6 }, // vol: 12 (limit 10)
      ])
    ).rejects.toThrow(CapacityExceededException);
  });
});
