import { FulfillAllocation } from "../../../src/application/useCases/FulfillAllocation";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";

describe("FulfillAllocation Use Case", () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;
  let useCase: FulfillAllocation;

  beforeEach(() => {
    mockRepo = {
      findBySku: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      findAllByLocation: jest.fn(),
      hasAnyEntries: jest.fn(),
      hasConflicts: jest.fn(),
    } as any;
    useCase = new FulfillAllocation(mockRepo);
  });

  it("should successfully fulfill allocation for an existing item", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create(
      "item-1",
      sku,
      "default",
      Quantity.create(10),
      Quantity.create(4),
      Quantity.create(0),
      1
    );
    mockRepo.findBySku.mockResolvedValue(item);

    await useCase.execute("SKU-123", 3);

    expect(item.allocated.getValue()).toBe(1);
    expect(item.quantity.getValue()).toBe(7);
    expect(mockRepo.save).toHaveBeenCalledWith(item);
  });

  it("should throw an error when the item is not found", async () => {
    mockRepo.findBySku.mockResolvedValue(null);

    await expect(useCase.execute("NON-EXISTENT-SKU", 3)).rejects.toThrow(
      "Inventory item for SKU NON-EXISTENT-SKU at location default not found."
    );
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("should throw an error when attempting to fulfill more than what is allocated", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create(
      "item-1",
      sku,
      "default",
      Quantity.create(10),
      Quantity.create(2), // Only 2 allocated
      Quantity.create(0),
      1
    );
    mockRepo.findBySku.mockResolvedValue(item);

    await expect(useCase.execute("SKU-123", 3)).rejects.toThrow(
      "Cannot fulfill allocation of 3 because only 2 is allocated."
    );
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("should successfully fulfill allocation using a custom locationId", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create(
      "item-1",
      sku,
      "custom-location",
      Quantity.create(10),
      Quantity.create(5),
      Quantity.create(0),
      1
    );
    mockRepo.findBySku.mockResolvedValue(item);

    await useCase.execute("SKU-123", 5, "custom-location");

    expect(mockRepo.findBySku).toHaveBeenCalledWith(sku, "custom-location");
    expect(item.allocated.getValue()).toBe(0);
    expect(item.quantity.getValue()).toBe(5);
    expect(mockRepo.save).toHaveBeenCalledWith(item);
  });
});
