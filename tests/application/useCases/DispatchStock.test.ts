import { DispatchStock } from "../../../src/application/useCases/DispatchStock";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { IExternalInventoryPublisher } from "../../../src/application/ports/IExternalInventoryPublisher";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";

describe("DispatchStock Use Case", () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;
  let mockPublisher: jest.Mocked<IExternalInventoryPublisher>;
  let useCase: DispatchStock;

  beforeEach(() => {
    mockRepo = {
      findBySku: jest.fn(),
      save: jest.fn(),
    } as any;
    mockPublisher = {
      publishStockLevel: jest.fn(),
    };
    useCase = new DispatchStock(mockRepo, mockPublisher);
  });

  it("should dispatch stock and publish to external system", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create("item-1", sku, Quantity.create(10));
    mockRepo.findBySku.mockResolvedValue(item);

    await useCase.execute("SKU-123", 5);

    expect(item.quantity.getValue()).toBe(5);
    expect(mockRepo.save).toHaveBeenCalledWith(item);
    expect(mockPublisher.publishStockLevel).toHaveBeenCalledWith(
      expect.any(SKU),
      expect.objectContaining({ value: 5 })
    );
  });

  it("should throw an error when the item is not found in inventory", async () => {
    mockRepo.findBySku.mockResolvedValue(null);

    await expect(useCase.execute("NON-EXISTENT-SKU", 5)).rejects.toThrow("Item not found in inventory");

    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockPublisher.publishStockLevel).not.toHaveBeenCalled();
  });
});
