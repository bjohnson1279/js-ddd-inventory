import { RMA } from "../../../src/domain/returns/aggregates/RMA";
import { RMAItem } from "../../../src/domain/returns/entities/RMAItem";
import { RMAStatus } from "../../../src/domain/returns/enums/RMAStatus";
import { RMAItemStatus } from "../../../src/domain/returns/enums/RMAItemStatus";
import { RMADisposition } from "../../../src/domain/returns/enums/RMADisposition";

describe("RMA Aggregate", () => {
  it("should initialize in REQUESTED status", () => {
    const item = new RMAItem("item-1", "VAR-1", 5, 1000);
    const rma = new RMA("rma-1", "RMA-001", "TEN-1", "CUST-1", "loc-1", RMAStatus.Requested, [item]);

    expect(rma.status).toBe(RMAStatus.Requested);
    expect(rma.items.length).toBe(1);
    expect(rma.items[0].receivedQuantity).toBe(0);
    expect(rma.items[0].status).toBe(RMAItemStatus.Pending);
  });

  it("should authorize requested RMAs", () => {
    const rma = new RMA("rma-1", "RMA-001", "TEN-1", "CUST-1", "loc-1", RMAStatus.Requested, []);
    rma.authorize();
    expect(rma.status).toBe(RMAStatus.Authorized);
  });

  it("should receive items and transition status", () => {
    const item = new RMAItem("item-1", "VAR-1", 5, 1000);
    const rma = new RMA("rma-1", "RMA-001", "TEN-1", "CUST-1", "loc-1", RMAStatus.Authorized, [item]);

    rma.receiveItem("VAR-1", 3, RMADisposition.Restock);
    expect(rma.status).toBe(RMAStatus.Received);
    expect(rma.items[0].receivedQuantity).toBe(3);
    expect(rma.items[0].status).toBe(RMAItemStatus.Pending);

    rma.receiveItem("VAR-1", 2, RMADisposition.Restock);
    expect(rma.status).toBe(RMAStatus.Completed);
    expect(rma.items[0].receivedQuantity).toBe(5);
    expect(rma.items[0].status).toBe(RMAItemStatus.Received);
  });

  it("should throw if trying to exceed expected quantity during receive", () => {
    const item = new RMAItem("item-1", "VAR-1", 5, 1000);
    const rma = new RMA("rma-1", "RMA-001", "TEN-1", "CUST-1", "loc-1", RMAStatus.Authorized, [item]);

    expect(() => rma.receiveItem("VAR-1", 6, RMADisposition.Restock)).toThrow(/would exceed expected quantity/i);
  });

  it("should throw if trying to authorize an RMA that is not in Requested status", () => {
    const rma = new RMA("rma-1", "RMA-001", "TEN-1", "CUST-1", "loc-1", RMAStatus.Authorized, []);
    expect(() => rma.authorize()).toThrow("Only requested RMAs can be authorized.");
  });

  it("should throw if receiving items on an RMA that is not Authorized or partially Received", () => {
    const item = new RMAItem("item-1", "VAR-1", 5, 1000);
    const rma = new RMA("rma-1", "RMA-001", "TEN-1", "CUST-1", "loc-1", RMAStatus.Requested, [item]);
    expect(() => rma.receiveItem("VAR-1", 1, RMADisposition.Restock)).toThrow("Can only receive items on Authorized or partially Received RMAs.");
  });

  it("should throw if receiving an item that is not found in the RMA", () => {
    const item = new RMAItem("item-1", "VAR-1", 5, 1000);
    const rma = new RMA("rma-1", "RMA-001", "TEN-1", "CUST-1", "loc-1", RMAStatus.Authorized, [item]);
    expect(() => rma.receiveItem("VAR-INVALID", 1, RMADisposition.Restock)).toThrow("Item VAR-INVALID not found in this RMA.");
  });

  it("should successfully reject an RMA from Requested status", () => {
    const rma = new RMA("rma-1", "RMA-001", "TEN-1", "CUST-1", "loc-1", RMAStatus.Requested, []);
    rma.reject();
    expect(rma.status).toBe(RMAStatus.Rejected);
  });

  it("should successfully reject an RMA from Authorized status", () => {
    const rma = new RMA("rma-1", "RMA-001", "TEN-1", "CUST-1", "loc-1", RMAStatus.Authorized, []);
    rma.reject();
    expect(rma.status).toBe(RMAStatus.Rejected);
  });

  it("should throw if trying to reject an RMA after receipt has started", () => {
    const item = new RMAItem("item-1", "VAR-1", 5, 1000);
    const rma = new RMA("rma-1", "RMA-001", "TEN-1", "CUST-1", "loc-1", RMAStatus.Received, [item]);
    expect(() => rma.reject()).toThrow("Cannot reject RMA after receipt has started.");
  });
});
