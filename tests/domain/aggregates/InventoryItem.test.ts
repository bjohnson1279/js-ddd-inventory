import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InsufficientAvailableStockException } from "../../../src/domain/exceptions/InsufficientAvailableStockException";

describe("InventoryItem Aggregate", () => {
  let sku: SKU;
  let initialQuantity: Quantity;

  beforeEach(() => {
    sku = SKU.create("TEST-SKU");
    initialQuantity = Quantity.create(10);
  });

  it("should create an InventoryItem", () => {
    const item = InventoryItem.create("123", sku, initialQuantity);
    expect(item.id).toBe("123");
    expect(item.sku.getValue()).toBe("TEST-SKU");
    expect(item.quantity.getValue()).toBe(10);
  });

  it("should receive stock", () => {
    const item = InventoryItem.create("123", sku, initialQuantity);
    item.receiveStock(Quantity.create(5));
    expect(item.quantity.getValue()).toBe(15);
    expect(item.getDomainEvents()).toHaveLength(0); // No event for receiving
  });

  it("should dispatch stock", () => {
    const item = InventoryItem.create("123", sku, initialQuantity);
    item.dispatchStock(Quantity.create(5));
    expect(item.quantity.getValue()).toBe(5);
    expect(item.getDomainEvents()).toHaveLength(0);
  });

  it("should raise StockDepletedEvent when stock reaches 0", () => {
    const item = InventoryItem.create("123", sku, initialQuantity);
    item.dispatchStock(Quantity.create(10));
    
    expect(item.quantity.getValue()).toBe(0);
    const events = item.getDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe("StockDepletedEvent");
  });

  it("should clear domain events", () => {
    const item = InventoryItem.create("123", sku, initialQuantity);
    item.dispatchStock(Quantity.create(10));
    expect(item.getDomainEvents()).toHaveLength(1);
    
    item.clearDomainEvents();
    expect(item.getDomainEvents()).toHaveLength(0);
  });

  it("should compute available stock (ATP) dynamically", () => {
    const item = InventoryItem.create("123", sku, initialQuantity);
    expect(item.available.getValue()).toBe(10);
    item.allocateStock(Quantity.create(4));
    expect(item.available.getValue()).toBe(6);
    item.createInTransit(Quantity.create(5));
    expect(item.available.getValue()).toBe(11);
  });

  it("should throw InsufficientAvailableStockException when allocating more than available", () => {
    const item = InventoryItem.create("123", sku, initialQuantity);
    expect(() => item.allocateStock(Quantity.create(11))).toThrow(
      InsufficientAvailableStockException
    );
  });

  it("should release allocated stock", () => {
    const item = InventoryItem.create("123", sku, initialQuantity);
    item.allocateStock(Quantity.create(4));
    item.releaseAllocation(Quantity.create(2));
    expect(item.allocated.getValue()).toBe(2);
    expect(item.available.getValue()).toBe(8);
  });

  it("should fulfill allocated stock", () => {
    const item = InventoryItem.create("123", sku, initialQuantity);
    item.allocateStock(Quantity.create(4));
    item.fulfillAllocation(Quantity.create(3));
    expect(item.allocated.getValue()).toBe(1);
    expect(item.quantity.getValue()).toBe(7);
    expect(item.available.getValue()).toBe(6);
  });

  it("should create, receive and cancel in-transit stock", () => {
    const item = InventoryItem.create("123", sku, initialQuantity);
    item.createInTransit(Quantity.create(6));
    expect(item.inTransit.getValue()).toBe(6);
    expect(item.available.getValue()).toBe(16);

    item.receiveInTransit(Quantity.create(4));
    expect(item.inTransit.getValue()).toBe(2);
    expect(item.quantity.getValue()).toBe(14);
    expect(item.available.getValue()).toBe(16);

    item.cancelInTransit(Quantity.create(2));
    expect(item.inTransit.getValue()).toBe(0);
    expect(item.quantity.getValue()).toBe(14);
    expect(item.available.getValue()).toBe(14);
  });
});
