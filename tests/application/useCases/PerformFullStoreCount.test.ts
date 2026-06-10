import { PerformFullStoreCount } from "../../../src/application/useCases/PerformFullStoreCount";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";

describe("PerformFullStoreCount Use Case", () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;
  let useCase: PerformFullStoreCount;

  beforeEach(() => {
    mockRepo = {
      findAllByLocation: jest.fn(),
      saveMany: jest.fn(),
      save: jest.fn(),
    } as any;
    useCase = new PerformFullStoreCount(mockRepo);
  });

  it("should update quantities of counted items", async () => {
    const sku1 = SKU.create("SKU-1");
    const item1 = InventoryItem.create("item-1", sku1, Quantity.create(10));
    const sku2 = SKU.create("SKU-2");
    const item2 = InventoryItem.create("item-2", sku2, Quantity.create(5));

    mockRepo.findAllByLocation.mockResolvedValue([item1, item2]);
    (mockRepo.saveMany as jest.Mock).mockResolvedValue(undefined);

    await useCase.execute([
      { sku: "SKU-1", count: 12 },
      { sku: "SKU-2", count: 5 }
    ]);

    expect(item1.quantity.getValue()).toBe(12);
    expect(item2.quantity.getValue()).toBe(5);

    expect(mockRepo.saveMany).toHaveBeenCalled();
    const savedItems = (mockRepo.saveMany as jest.Mock).mock.calls[0][0];
    expect(savedItems).toHaveLength(2);
    expect(savedItems).toContain(item1);
    expect(savedItems).toContain(item2);
  });

  it("should zero out uncounted items", async () => {
    const sku1 = SKU.create("SKU-1");
    const item1 = InventoryItem.create("item-1", sku1, Quantity.create(10));
    const sku2 = SKU.create("SKU-2");
    const item2 = InventoryItem.create("item-2", sku2, Quantity.create(5));

    mockRepo.findAllByLocation.mockResolvedValue([item1, item2]);
    (mockRepo.saveMany as jest.Mock).mockResolvedValue(undefined);

    await useCase.execute([
      { sku: "SKU-1", count: 12 }
    ]);

    expect(item1.quantity.getValue()).toBe(12);
    expect(item2.quantity.getValue()).toBe(0);

    expect(mockRepo.saveMany).toHaveBeenCalled();
    const savedItems = (mockRepo.saveMany as jest.Mock).mock.calls[0][0];
    expect(savedItems).toHaveLength(2);
    expect(savedItems).toContain(item1);
    expect(savedItems).toContain(item2);
  });

  it("should add new items that weren't in the DB before", async () => {
    const sku1 = SKU.create("SKU-1");
    const item1 = InventoryItem.create("item-1", sku1, Quantity.create(10));

    mockRepo.findAllByLocation.mockResolvedValue([item1]);
    (mockRepo.saveMany as jest.Mock).mockResolvedValue(undefined);

    await useCase.execute([
      { sku: "SKU-1", count: 10 },
      { sku: "NEW-SKU", count: 3 }
    ]);

    expect(item1.quantity.getValue()).toBe(10);

    expect(mockRepo.saveMany).toHaveBeenCalled();
    const savedItems = (mockRepo.saveMany as jest.Mock).mock.calls[0][0];
    expect(savedItems).toHaveLength(2);

    const newItem = savedItems.find((i: InventoryItem) => i.sku.getValue() === "NEW-SKU");
    expect(newItem).toBeDefined();
    expect(newItem!.quantity.getValue()).toBe(3);
  });

  it("should fall back to Promise.all(save) if saveMany is not available", async () => {
    mockRepo = {
      findAllByLocation: jest.fn(),
      save: jest.fn(),
    } as any;
    useCase = new PerformFullStoreCount(mockRepo);

    const sku1 = SKU.create("SKU-1");
    const item1 = InventoryItem.create("item-1", sku1, Quantity.create(10));

    mockRepo.findAllByLocation.mockResolvedValue([item1]);
    mockRepo.save.mockResolvedValue(undefined);

    await useCase.execute([
      { sku: "SKU-1", count: 10 }
    ]);

    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    expect(mockRepo.save).toHaveBeenCalledWith(item1);
  });
});
