import { PurchaseOrder } from "../../../src/domain/procurement/aggregates/PurchaseOrder";
import { PurchaseOrderItem } from "../../../src/domain/procurement/aggregates/PurchaseOrderItem";
import { PurchaseOrderStatus } from "../../../src/domain/procurement/enums/PurchaseOrderStatus";

describe("PurchaseOrder Aggregate", () => {
  it("should be created in Draft status", () => {
    const item = new PurchaseOrderItem("item-1", "variant-A", 10, 1500);
    const po = new PurchaseOrder("po-1", "PO-100", "vendor-1", "tenant-1", "location-1", undefined, [item]);

    expect(po.status).toBe(PurchaseOrderStatus.Draft);
    expect(po.items.length).toBe(1);
    expect(po.items[0].receivedQuantity).toBe(0);
  });

  it("should transition status from Draft to Approved", () => {
    const po = new PurchaseOrder("po-1", "PO-100", "vendor-1", "tenant-1", "location-1");
    po.approve();
    expect(po.status).toBe(PurchaseOrderStatus.Approved);
  });

  it("should transition status from Approved to Sent", () => {
    const po = new PurchaseOrder("po-1", "PO-100", "vendor-1", "tenant-1", "location-1", PurchaseOrderStatus.Approved);
    po.send();
    expect(po.status).toBe(PurchaseOrderStatus.Sent);
  });

  it("should receive items and update status to PartiallyReceived or Received", () => {
    const itemA = new PurchaseOrderItem("item-1", "variant-A", 10, 1500);
    const itemB = new PurchaseOrderItem("item-2", "variant-B", 5, 2000);
    const po = new PurchaseOrder("po-1", "PO-100", "vendor-1", "tenant-1", "location-1", PurchaseOrderStatus.Sent, [itemA, itemB]);

    // Partially receive item A
    po.receiveItems("variant-A", 4);
    expect(po.status).toBe(PurchaseOrderStatus.PartiallyReceived);
    expect(itemA.receivedQuantity).toBe(4);

    // Fully receive item A
    po.receiveItems("variant-A", 6);
    expect(po.status).toBe(PurchaseOrderStatus.PartiallyReceived);
    expect(itemA.isFullyReceived()).toBe(true);

    // Fully receive item B
    po.receiveItems("variant-B", 5);
    expect(po.status).toBe(PurchaseOrderStatus.Received);
    expect(itemB.isFullyReceived()).toBe(true);
  });

  it("should throw error if receiving on Draft or Approved order", () => {
    const item = new PurchaseOrderItem("item-1", "variant-A", 10, 1500);
    const po = new PurchaseOrder("po-1", "PO-100", "vendor-1", "tenant-1", "location-1", PurchaseOrderStatus.Draft, [item]);

    expect(() => po.receiveItems("variant-A", 5)).toThrow("Can only receive items on Sent or Partially Received purchase orders.");
  });

  it("should throw error if receiving more than ordered", () => {
    const item = new PurchaseOrderItem("item-1", "variant-A", 10, 1500);
    const po = new PurchaseOrder("po-1", "PO-100", "vendor-1", "tenant-1", "location-1", PurchaseOrderStatus.Sent, [item]);

    expect(() => po.receiveItems("variant-A", 12)).toThrow("Total received would exceed ordered quantity");
  });
});
