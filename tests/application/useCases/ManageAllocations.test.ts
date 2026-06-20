import { AllocateStock } from "../../../src/application/useCases/AllocateStock";
import { ReleaseAllocation } from "../../../src/application/useCases/ReleaseAllocation";
import { FulfillAllocation } from "../../../src/application/useCases/FulfillAllocation";
import { CreateInTransit } from "../../../src/application/useCases/CreateInTransit";
import { ReceiveInTransit } from "../../../src/application/useCases/ReceiveInTransit";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InsufficientAvailableStockException } from "../../../src/domain/exceptions/InsufficientAvailableStockException";

describe("ManageAllocations Use Cases", () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;
  const sku = SKU.create("SKU-123");

  beforeEach(() => {
    mockRepo = {
      findBySku: jest.fn(),
      save: jest.fn(),
    } as any;
  });

  describe("AllocateStock Use Case", () => {
    it("should allocate stock on existing item", async () => {
      const item = InventoryItem.create("item-1", sku, "default", Quantity.create(10));
      mockRepo.findBySku.mockResolvedValue(item);

      const useCase = new AllocateStock(mockRepo);
      await useCase.execute("SKU-123", 4, "default");

      expect(item.allocated.getValue()).toBe(4);
      expect(item.available.getValue()).toBe(6);
      expect(mockRepo.save).toHaveBeenCalledWith(item);
    });

    it("should fail to allocate if requested amount exceeds ATP", async () => {
      const item = InventoryItem.create("item-1", sku, "default", Quantity.create(10));
      mockRepo.findBySku.mockResolvedValue(item);

      const useCase = new AllocateStock(mockRepo);
      await expect(useCase.execute("SKU-123", 11, "default")).rejects.toThrow(
        InsufficientAvailableStockException
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("ReleaseAllocation Use Case", () => {
    it("should release allocation", async () => {
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

      const useCase = new ReleaseAllocation(mockRepo);
      await useCase.execute("SKU-123", 2, "default");

      expect(item.allocated.getValue()).toBe(2);
      expect(item.available.getValue()).toBe(8);
      expect(mockRepo.save).toHaveBeenCalledWith(item);
    });
  });

  describe("FulfillAllocation Use Case", () => {
    it("should fulfill allocation", async () => {
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

      const useCase = new FulfillAllocation(mockRepo);
      await useCase.execute("SKU-123", 3, "default");

      expect(item.allocated.getValue()).toBe(1);
      expect(item.quantity.getValue()).toBe(7);
      expect(mockRepo.save).toHaveBeenCalledWith(item);
    });
  });

  describe("CreateInTransit Use Case", () => {
    it("should create in-transit stock", async () => {
      const item = InventoryItem.create("item-1", sku, "default", Quantity.create(10));
      mockRepo.findBySku.mockResolvedValue(item);

      const useCase = new CreateInTransit(mockRepo);
      await useCase.execute("SKU-123", 5, "default");

      expect(item.inTransit.getValue()).toBe(5);
      expect(item.available.getValue()).toBe(15);
      expect(mockRepo.save).toHaveBeenCalledWith(item);
    });
  });

  describe("ReceiveInTransit Use Case", () => {
    it("should receive in-transit stock", async () => {
      const item = InventoryItem.create(
        "item-1",
        sku,
        "default",
        Quantity.create(10),
        Quantity.create(0),
        Quantity.create(5),
        1
      );
      mockRepo.findBySku.mockResolvedValue(item);

      const useCase = new ReceiveInTransit(mockRepo);
      await useCase.execute("SKU-123", 3, "default");

      expect(item.inTransit.getValue()).toBe(2);
      expect(item.quantity.getValue()).toBe(13);
      expect(mockRepo.save).toHaveBeenCalledWith(item);
    });
  });
});
