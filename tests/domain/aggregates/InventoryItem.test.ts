import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";

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
});
