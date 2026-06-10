import {
  SerializedItemStatus,
  canTransitionTo,
  isCountedInStock,
  requiresLedgerEntry
} from '../../../../src/domain/serial/enums/SerializedItemStatus';

describe('SerializedItemStatus', () => {
  describe('canTransitionTo', () => {
    it('should allow valid transitions', () => {
      expect(canTransitionTo(SerializedItemStatus.Pending, SerializedItemStatus.InStock)).toBe(true);
      expect(canTransitionTo(SerializedItemStatus.InStock, SerializedItemStatus.Sold)).toBe(true);
      expect(canTransitionTo(SerializedItemStatus.Sold, SerializedItemStatus.Returned)).toBe(true);
      expect(canTransitionTo(SerializedItemStatus.Returned, SerializedItemStatus.InStock)).toBe(true);
      expect(canTransitionTo(SerializedItemStatus.Quarantined, SerializedItemStatus.WrittenOff)).toBe(true);
      expect(canTransitionTo(SerializedItemStatus.Transferred, SerializedItemStatus.Damaged)).toBe(true);
      expect(canTransitionTo(SerializedItemStatus.Damaged, SerializedItemStatus.WrittenOff)).toBe(true);
    });

    it('should prevent invalid transitions', () => {
      expect(canTransitionTo(SerializedItemStatus.Pending, SerializedItemStatus.Sold)).toBe(false);
      expect(canTransitionTo(SerializedItemStatus.Sold, SerializedItemStatus.InStock)).toBe(false);
      expect(canTransitionTo(SerializedItemStatus.WrittenOff, SerializedItemStatus.InStock)).toBe(false);
      expect(canTransitionTo('unknown' as SerializedItemStatus, SerializedItemStatus.InStock)).toBe(false);
    });
  });

  describe('isCountedInStock', () => {
    it('should return true only for InStock', () => {
      expect(isCountedInStock(SerializedItemStatus.InStock)).toBe(true);
      expect(isCountedInStock(SerializedItemStatus.Pending)).toBe(false);
      expect(isCountedInStock(SerializedItemStatus.Sold)).toBe(false);
      expect(isCountedInStock(SerializedItemStatus.Damaged)).toBe(false);
    });
  });

  describe('requiresLedgerEntry', () => {
    it('should require entry when moving into stock', () => {
      expect(requiresLedgerEntry(SerializedItemStatus.Pending, SerializedItemStatus.InStock)).toBe(true);
    });

    it('should require entry when moving out of stock', () => {
      expect(requiresLedgerEntry(SerializedItemStatus.InStock, SerializedItemStatus.Sold)).toBe(true);
    });

    it('should not require entry when stock status doesnt change', () => {
      expect(requiresLedgerEntry(SerializedItemStatus.Pending, SerializedItemStatus.Damaged)).toBe(false);
      expect(requiresLedgerEntry(SerializedItemStatus.InStock, SerializedItemStatus.InStock)).toBe(false);
    });
  });
});
