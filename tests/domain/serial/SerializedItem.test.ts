import { SerializedItem } from "../../../src/domain/serial/aggregates/SerializedItem";
import { SerialNumber } from "../../../src/domain/serial/valueObjects/SerialNumber";
import { SerializedItemStatus } from "../../../src/domain/serial/enums/SerializedItemStatus";
import { InvalidSerialStatusTransitionException } from "../../../src/domain/serial/exceptions/InvalidSerialStatusTransitionException";

describe("SerializedItem Aggregate", () => {
  it("should initialize in Pending status", () => {
    const sn = new SerialNumber("SN-123");
    const item = new SerializedItem("1", "SKU-A", sn, "TEN-1", "LOC-1");

    expect(item.status).toBe(SerializedItemStatus.Pending);
    expect(item.locationId).toBe("LOC-1");
    expect(item.history.length).toBe(0);
    expect(item.isAvailable()).toBe(false);
  });

  it("should transition through normal lifecycle successfully", () => {
    const sn = new SerialNumber("SN-123");
    const item = new SerializedItem("1", "SKU-A", sn, "TEN-1", "LOC-1");

    item.receive("LOC-1", "user-1", "PO-1");
    expect(item.status).toBe(SerializedItemStatus.InStock);
    expect(item.isAvailable()).toBe(true);
    expect(item.history.length).toBe(1);
    expect(item.history[0].to).toBe(SerializedItemStatus.InStock);
    expect(item.history[0].reason).toContain("PO-1");

    item.sell("SALE-1", "user-2");
    expect(item.status).toBe(SerializedItemStatus.Sold);
    expect(item.isAvailable()).toBe(false);
    expect(item.history.length).toBe(2);

    item.acceptReturn("RET-1", "user-3");
    expect(item.status).toBe(SerializedItemStatus.Returned);
    expect(item.history.length).toBe(3);

    item.restock("user-4", "RET-1");
    expect(item.status).toBe(SerializedItemStatus.InStock);
    expect(item.history.length).toBe(4);
  });

  it("should prevent invalid state transitions", () => {
    const sn = new SerialNumber("SN-123");
    const item = new SerializedItem("1", "SKU-A", sn, "TEN-1", "LOC-1");

    expect(() => item.sell("SALE-1", "user-1")).toThrow(InvalidSerialStatusTransitionException);
  });

  it("should generate events when state transitions occur", () => {
    const sn = new SerialNumber("SN-123");
    const item = new SerializedItem("1", "SKU-A", sn, "TEN-1", "LOC-1");

    item.receive("LOC-1", "user-1", "PO-1");
    const events = item.releaseEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("SerialStatusChanged");
    expect(events[0].to).toBe(SerializedItemStatus.InStock);
    expect(events[0].requiresLedgerEntry).toBe(true);

    expect(item.releaseEvents().length).toBe(0);
  });
});
