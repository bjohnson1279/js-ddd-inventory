import { ReceiveInTransit } from "../../../src/application/useCases/ReceiveInTransit";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";

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

  it("should receive in-transit stock successfully", async () => {
    const sku = SKU.create("SKU-123");
    // Create inventory item with 10 on-hand, 0 allocated, 5 in-transit
    const item = InventoryItem.create("item-1", sku, "default", Quantity.create(10), Quantity.create(0), Quantity.create(5));

    mockRepo.findBySku.mockResolvedValue(item);

    await useCase.execute("SKU-123", 5);

    // Assert quantity is increased and in-transit is decreased
    expect(item.quantity.getValue()).toBe(15);
    expect(item.inTransit.getValue()).toBe(0);
    expect(mockRepo.save).toHaveBeenCalledWith(item);
  });

  it("should throw an error if inventory item not found", async () => {
    mockRepo.findBySku.mockResolvedValue(null);

    await expect(useCase.execute("NON-EXISTENT", 5)).rejects.toThrow(
      "Inventory item for SKU NON-EXISTENT at location default not found."
    );
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("should use specified locationId when provided", async () => {
    const sku = SKU.create("SKU-LOC");
    const item = InventoryItem.create("item-loc", sku, "loc-123", Quantity.create(10), Quantity.create(0), Quantity.create(5));

    mockRepo.findBySku.mockResolvedValue(item);

    await useCase.execute("SKU-LOC", 5, "loc-123");

    expect(mockRepo.findBySku).toHaveBeenCalledWith(expect.any(SKU), "loc-123");
    expect(item.quantity.getValue()).toBe(15);
    expect(item.inTransit.getValue()).toBe(0);
    expect(mockRepo.save).toHaveBeenCalledWith(item);
  });
});
