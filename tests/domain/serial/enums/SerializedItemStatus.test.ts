import { SerializedItemStatus, isCountedInStock, requiresLedgerEntry } from "../../../../src/domain/serial/enums/SerializedItemStatus";

describe("SerializedItemStatus Utilities", () => {
  describe("isCountedInStock", () => {
    it("should return true only for InStock", () => {
      expect(isCountedInStock(SerializedItemStatus.InStock)).toBe(true);
    });

    it("should return false for all other statuses", () => {
      const otherStatuses = (Object.values(SerializedItemStatus) as SerializedItemStatus[]).filter(
        (status) => status !== SerializedItemStatus.InStock
      );
      otherStatuses.forEach((status) => {
        expect(isCountedInStock(status)).toBe(false);
      });
    });
  });

  describe("requiresLedgerEntry", () => {
    it("should return true when moving into stock", () => {
      expect(requiresLedgerEntry(SerializedItemStatus.Pending, SerializedItemStatus.InStock)).toBe(true);
      expect(requiresLedgerEntry(SerializedItemStatus.Returned, SerializedItemStatus.InStock)).toBe(true);
    });

    it("should return true when moving out of stock", () => {
      expect(requiresLedgerEntry(SerializedItemStatus.InStock, SerializedItemStatus.Sold)).toBe(true);
      expect(requiresLedgerEntry(SerializedItemStatus.InStock, SerializedItemStatus.Damaged)).toBe(true);
    });

    it("should return false for transitions not involving stock", () => {
      expect(requiresLedgerEntry(SerializedItemStatus.Pending, SerializedItemStatus.Damaged)).toBe(false);
      expect(requiresLedgerEntry(SerializedItemStatus.Sold, SerializedItemStatus.Returned)).toBe(false);
    });

    it("should return false for no-op transitions", () => {
      expect(requiresLedgerEntry(SerializedItemStatus.InStock, SerializedItemStatus.InStock)).toBe(false);
      expect(requiresLedgerEntry(SerializedItemStatus.Pending, SerializedItemStatus.Pending)).toBe(false);
    });
  });
});
