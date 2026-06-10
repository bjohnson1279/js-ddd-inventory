import { GetStockLevel } from "../../../src/application/useCases/GetStockLevel";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InvalidSKUException } from "../../../src/domain/exceptions/InvalidSKUException";

describe("GetStockLevel Use Case", () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;
  let useCase: GetStockLevel;

  beforeEach(() => {
    mockRepo = {
      findBySku: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      findAllByLocation: jest.fn(),
      hasAnyEntries: jest.fn(),
    } as any;
    useCase = new GetStockLevel(mockRepo);
  });

  it("should return the quantity when the item exists (with locationId)", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create("item-1", sku, "location-1", Quantity.create(15));
    mockRepo.findBySku.mockResolvedValue(item);

    const result = await useCase.execute("SKU-123", "location-1");

    expect(result).toBe(15);
    expect(mockRepo.findBySku).toHaveBeenCalledWith(expect.any(SKU), "location-1");
    expect(mockRepo.findBySku.mock.calls[0][0].getValue()).toBe("SKU-123");
  });

  it("should return the quantity when the item exists (without locationId)", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create("item-1", sku, "default", Quantity.create(15));
    mockRepo.findBySku.mockResolvedValue(item);

    const result = await useCase.execute("SKU-123");

    expect(result).toBe(15);
    expect(mockRepo.findBySku).toHaveBeenCalledWith(expect.any(SKU), "default");
    expect(mockRepo.findBySku.mock.calls[0][0].getValue()).toBe("SKU-123");
  });

  it("should return 0 when the item does not exist", async () => {
    mockRepo.findBySku.mockResolvedValue(null);

    const result = await useCase.execute("NEW-SKU");

    expect(result).toBe(0);
    expect(mockRepo.findBySku).toHaveBeenCalledWith(expect.any(SKU), "default");
  });

  it("should throw an error for an invalid SKU", async () => {
    await expect(useCase.execute("")).rejects.toThrow(InvalidSKUException);
    expect(mockRepo.findBySku).not.toHaveBeenCalled();
  });
});
