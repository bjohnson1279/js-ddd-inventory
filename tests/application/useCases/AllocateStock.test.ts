import { AllocateStock } from "../../../src/application/useCases/AllocateStock";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InsufficientAvailableStockException } from "../../../src/domain/exceptions/InsufficientAvailableStockException";

describe("AllocateStock Use Case", () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;
  let useCase: AllocateStock;

  beforeEach(() => {
    mockRepo = {
      findBySku: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      findAllByLocation: jest.fn(),
      hasAnyEntries: jest.fn(),
      hasConflicts: jest.fn(),
    } as any;
    useCase = new AllocateStock(mockRepo);
  });

  it("should allocate stock successfully to an existing item", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create("item-1", sku, "default", Quantity.create(10));
    mockRepo.findBySku.mockResolvedValue(item);

    await useCase.execute("SKU-123", 5);

    expect(item.allocated.getValue()).toBe(5);
    expect(mockRepo.save).toHaveBeenCalledWith(item);
  });

  it("should throw InsufficientAvailableStockException when allocation exceeds available quantity", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create("item-1", sku, "default", Quantity.create(10));
    mockRepo.findBySku.mockResolvedValue(item);

    await expect(useCase.execute("SKU-123", 15)).rejects.toThrow(InsufficientAvailableStockException);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("should create a new item and allocate stock if the item is not found in inventory, and fail because available is 0", async () => {
    mockRepo.findBySku.mockResolvedValue(null);

    await expect(useCase.execute("NON-EXISTENT-SKU", 5)).rejects.toThrow(InsufficientAvailableStockException);
    expect(mockRepo.findBySku).toHaveBeenCalledWith(SKU.create("NON-EXISTENT-SKU"), "default");
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("should allocate stock successfully using a custom locationId", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create("item-1", sku, "custom-location", Quantity.create(10));
    mockRepo.findBySku.mockResolvedValue(item);

    await useCase.execute("SKU-123", 5, "custom-location");

    expect(mockRepo.findBySku).toHaveBeenCalledWith(sku, "custom-location");
    expect(item.allocated.getValue()).toBe(5);
    expect(mockRepo.save).toHaveBeenCalledWith(item);
  });
});
