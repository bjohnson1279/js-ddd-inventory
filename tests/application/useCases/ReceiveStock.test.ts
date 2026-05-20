import { ReceiveStock } from "../../../src/application/useCases/ReceiveStock";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { IExternalInventoryPublisher } from "../../../src/application/ports/IExternalInventoryPublisher";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";

describe("ReceiveStock Use Case", () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;
  let mockPublisher: jest.Mocked<IExternalInventoryPublisher>;
  let useCase: ReceiveStock;

  beforeEach(() => {
    mockRepo = {
      findBySku: jest.fn(),
      save: jest.fn(),
    } as any;
    mockPublisher = {
      publishStockLevel: jest.fn(),
    };
    useCase = new ReceiveStock(mockRepo, mockPublisher);
  });

  it("should receive stock and publish to external system", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create("item-1", sku, Quantity.create(10));
    mockRepo.findBySku.mockResolvedValue(item);

    await useCase.execute("SKU-123", 5);

    expect(item.quantity.getValue()).toBe(15);
    expect(mockRepo.save).toHaveBeenCalledWith(item);
    expect(mockPublisher.publishStockLevel).toHaveBeenCalledWith(
      expect.any(SKU),
      expect.objectContaining({ value: 15 })
    );
  });

  it("should create new item if it doesn't exist", async () => {
    mockRepo.findBySku.mockResolvedValue(null);

    await useCase.execute("NEW-SKU", 10);

    expect(mockRepo.save).toHaveBeenCalled();
    const savedItem = mockRepo.save.mock.calls[0][0];
    expect(savedItem.sku.getValue()).toBe("NEW-SKU");
    expect(savedItem.quantity.getValue()).toBe(10);
  });
});
