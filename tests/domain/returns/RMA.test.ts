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
});
