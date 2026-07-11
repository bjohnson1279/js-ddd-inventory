import { ReceiveInTransit } from "../../../src/application/useCases/ReceiveInTransit";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InvalidSKUException } from "../../../src/domain/exceptions/InvalidSKUException";
import { InvalidQuantityException } from "../../../src/domain/exceptions/InvalidQuantityException";

describe("ReceiveInTransit Use Case", () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;
  let useCase: ReceiveInTransit;

  beforeEach(() => {
    mockRepo = {
      findBySku: jest.fn(),
      save: jest.fn(),
    } as any;
    useCase = new ReceiveInTransit(mockRepo);
  });

  it("should receive in-transit quantity for an existing item", async () => {
    const sku = SKU.create("SKU-123");
    // Create an item with 10 stock, 0 allocated, 5 inTransit
    const item = InventoryItem.create("item-1", sku, "default", Quantity.create(10), Quantity.create(0), Quantity.create(5));

    mockRepo.findBySku.mockResolvedValue(item);

    await useCase.execute("SKU-123", 5);

    expect(mockRepo.findBySku).toHaveBeenCalledWith(expect.any(SKU), "default");
    expect(item.quantity.getValue()).toBe(15);
    expect(item.inTransit.getValue()).toBe(0);
    expect(mockRepo.save).toHaveBeenCalledWith(item);
  });

  it("should handle custom locationId correctly", async () => {
    const sku = SKU.create("SKU-456");
    const item = InventoryItem.create("item-2", sku, "location-b", Quantity.create(20), Quantity.create(0), Quantity.create(10));

    mockRepo.findBySku.mockResolvedValue(item);

    await useCase.execute("SKU-456", 10, "location-b");

    expect(mockRepo.findBySku).toHaveBeenCalledWith(expect.any(SKU), "location-b");
    expect(item.quantity.getValue()).toBe(30);
    expect(item.inTransit.getValue()).toBe(0);
    expect(mockRepo.save).toHaveBeenCalledWith(item);
  });

  it("should throw an error if the item does not exist", async () => {
    mockRepo.findBySku.mockResolvedValue(null);

    await expect(useCase.execute("SKU-123", 5)).rejects.toThrow("Inventory item for SKU SKU-123 at location default not found.");

    expect(mockRepo.findBySku).toHaveBeenCalledWith(expect.any(SKU), "default");
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("should throw an error if receiving more than in transit", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create("item-1", sku, "default", Quantity.create(10), Quantity.create(0), Quantity.create(2));

    mockRepo.findBySku.mockResolvedValue(item);

    await expect(useCase.execute("SKU-123", 5)).rejects.toThrow("Cannot receive in transit of 5 because only 2 is in transit.");

    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("should throw an error for an invalid SKU", async () => {
    await expect(useCase.execute("", 5)).rejects.toThrow(InvalidSKUException);
    expect(mockRepo.findBySku).not.toHaveBeenCalled();
  });

  it("should throw an error for a negative quantity", async () => {
    await expect(useCase.execute("SKU-123", -5)).rejects.toThrow(InvalidQuantityException);
    expect(mockRepo.findBySku).not.toHaveBeenCalled();
  });
});
