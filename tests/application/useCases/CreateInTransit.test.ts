import { CreateInTransit } from "../../../src/application/useCases/CreateInTransit";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InvalidSKUException } from "../../../src/domain/exceptions/InvalidSKUException";
import { InvalidQuantityException } from "../../../src/domain/exceptions/InvalidQuantityException";

describe("CreateInTransit Use Case", () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;
  let useCase: CreateInTransit;

  beforeEach(() => {
    mockRepo = {
      findBySku: jest.fn(),
      save: jest.fn(),
    } as any;
    useCase = new CreateInTransit(mockRepo);
  });

  it("should create in-transit stock for an existing item", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create("item-1", sku, "default", Quantity.create(10), Quantity.create(0), Quantity.create(0));

    mockRepo.findBySku.mockResolvedValue(item);

    await useCase.execute("SKU-123", 5);

    expect(mockRepo.findBySku).toHaveBeenCalledWith(expect.any(SKU), "default");
    expect(item.inTransit.getValue()).toBe(5);
    expect(mockRepo.save).toHaveBeenCalledWith(item);
  });

  it("should create a new inventory item and add in-transit stock if item not found", async () => {
    mockRepo.findBySku.mockResolvedValue(null);

    await useCase.execute("NEW-SKU", 10, "loc-456");

    expect(mockRepo.findBySku).toHaveBeenCalledWith(expect.any(SKU), "loc-456");

    // Check what was saved
    expect(mockRepo.save).toHaveBeenCalledWith(expect.any(InventoryItem));

    const savedItem = mockRepo.save.mock.calls[0][0];
    expect(savedItem.sku.getValue()).toBe("NEW-SKU");
    expect(savedItem.locationId).toBe("loc-456");
    expect(savedItem.quantity.getValue()).toBe(0);
    expect(savedItem.inTransit.getValue()).toBe(10);
  });

  it("should use specified locationId when provided", async () => {
    const sku = SKU.create("SKU-LOC");
    const item = InventoryItem.create("item-loc", sku, "loc-123", Quantity.create(10), Quantity.create(0), Quantity.create(0));

    mockRepo.findBySku.mockResolvedValue(item);

    await useCase.execute("SKU-LOC", 5, "loc-123");

    expect(mockRepo.findBySku).toHaveBeenCalledWith(expect.any(SKU), "loc-123");
    expect(item.inTransit.getValue()).toBe(5);
    expect(mockRepo.save).toHaveBeenCalledWith(item);
  });

  it("should default locationId to 'default' when locationId is omitted for a new item", async () => {
    mockRepo.findBySku.mockResolvedValue(null);

    await useCase.execute("SKU-DEFAULT", 7);

    expect(mockRepo.findBySku).toHaveBeenCalledWith(expect.any(SKU), "default");
    expect(mockRepo.save).toHaveBeenCalledWith(expect.any(InventoryItem));

    const savedItem = mockRepo.save.mock.calls[0][0];
    expect(savedItem.sku.getValue()).toBe("SKU-DEFAULT");
    expect(savedItem.locationId).toBe("default");
    expect(savedItem.quantity.getValue()).toBe(0);
    expect(savedItem.inTransit.getValue()).toBe(7);
  });

  it("should allow zero in-transit quantity", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create("item-1", sku, "default", Quantity.create(10), Quantity.create(0), Quantity.create(0));

    mockRepo.findBySku.mockResolvedValue(item);

    await useCase.execute("SKU-123", 0);

    expect(item.inTransit.getValue()).toBe(0);
    expect(mockRepo.save).toHaveBeenCalledWith(item);
  });

  it("should throw InvalidQuantityException when quantity is negative", async () => {
    await expect(useCase.execute("SKU-123", -5)).rejects.toThrow(InvalidQuantityException);
    expect(mockRepo.findBySku).not.toHaveBeenCalled();
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("should throw InvalidQuantityException when quantity is not an integer", async () => {
    await expect(useCase.execute("SKU-123", 2.5)).rejects.toThrow(InvalidQuantityException);
    expect(mockRepo.findBySku).not.toHaveBeenCalled();
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("should throw InvalidSKUException when SKU is empty or blank", async () => {
    await expect(useCase.execute("", 5)).rejects.toThrow(InvalidSKUException);
    await expect(useCase.execute("   ", 5)).rejects.toThrow(InvalidSKUException);
    expect(mockRepo.findBySku).not.toHaveBeenCalled();
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("should throw InvalidSKUException when SKU is shorter than 3 characters", async () => {
    await expect(useCase.execute("AB", 5)).rejects.toThrow(InvalidSKUException);
    expect(mockRepo.findBySku).not.toHaveBeenCalled();
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("should propagate errors if findBySku fails", async () => {
    mockRepo.findBySku.mockRejectedValue(new Error("Database connection error"));

    await expect(useCase.execute("SKU-123", 5)).rejects.toThrow("Database connection error");
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("should propagate errors if save fails", async () => {
    const sku = SKU.create("SKU-123");
    const item = InventoryItem.create("item-1", sku, "default", Quantity.create(10), Quantity.create(0), Quantity.create(0));

    mockRepo.findBySku.mockResolvedValue(item);
    mockRepo.save.mockRejectedValue(new Error("Database write error"));

    await expect(useCase.execute("SKU-123", 5)).rejects.toThrow("Database write error");
  });
});
