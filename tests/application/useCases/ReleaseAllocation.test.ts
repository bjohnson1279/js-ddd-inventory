import { ReleaseAllocation } from "../../../src/application/useCases/ReleaseAllocation";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";

describe("ReleaseAllocation Use Case", () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;
  let useCase: ReleaseAllocation;

  beforeEach(() => {
    mockRepo = {
      findBySku: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      findAllByLocation: jest.fn(),
      hasAnyEntries: jest.fn(),
      hasConflicts: jest.fn(),
    } as any;
    useCase = new ReleaseAllocation(mockRepo);
  });

  it("should release allocation successfully for an existing item", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create("item-1", sku, "default", Quantity.create(10), Quantity.create(5));
    mockRepo.findBySku.mockResolvedValue(item);

    await useCase.execute("SKU-123", 2);

    expect(item.allocated.getValue()).toBe(3);
    expect(mockRepo.save).toHaveBeenCalledWith(item);
  });

  it("should throw an Error if the inventory item is not found", async () => {
    mockRepo.findBySku.mockResolvedValue(null);

    await expect(useCase.execute("NON-EXISTENT-SKU", 5)).rejects.toThrow(
      "Inventory item for SKU NON-EXISTENT-SKU at location default not found."
    );
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("should throw an Error if trying to release more than allocated", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create("item-1", sku, "default", Quantity.create(10), Quantity.create(5));
    mockRepo.findBySku.mockResolvedValue(item);

    await expect(useCase.execute("SKU-123", 10)).rejects.toThrow(
      "Cannot release allocation of 10 because only 5 is allocated."
    );
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("should release allocation successfully using a custom locationId", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create("item-1", sku, "custom-location", Quantity.create(10), Quantity.create(5));
    mockRepo.findBySku.mockResolvedValue(item);

    await useCase.execute("SKU-123", 3, "custom-location");

    expect(mockRepo.findBySku).toHaveBeenCalledWith(sku, "custom-location");
    expect(item.allocated.getValue()).toBe(2);
    expect(mockRepo.save).toHaveBeenCalledWith(item);
  });
});
