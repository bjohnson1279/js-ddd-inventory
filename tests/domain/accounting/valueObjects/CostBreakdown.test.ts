import { CostBreakdown } from '../../../../src/domain/accounting/valueObjects/CostBreakdown';

describe('CostBreakdown', () => {
  describe('constructor', () => {
    it('should correctly assign units and totalCostCents', () => {
      const breakdown = new CostBreakdown(10, 1000);
      expect(breakdown.units).toBe(10);
      expect(breakdown.totalCostCents).toBe(1000);
    });
  });

  describe('unitCostCents', () => {
    it('should correctly calculate unit cost with even division', () => {
      const breakdown = new CostBreakdown(10, 1000);
      expect(breakdown.unitCostCents).toBe(100);
    });

    it('should correctly round unit cost when division is not even (round up)', () => {
      // 1000 / 3 = 333.33 -> 333
      // Let's do 1000 / 6 = 166.66... -> 167
      const breakdown = new CostBreakdown(6, 1000);
      expect(breakdown.unitCostCents).toBe(167);
    });

    it('should correctly round unit cost when division is not even (round down)', () => {
      // 1000 / 3 = 333.33... -> 333
      const breakdown = new CostBreakdown(3, 1000);
      expect(breakdown.unitCostCents).toBe(333);
    });

    it('should return 0 when units is 0', () => {
      const breakdown = new CostBreakdown(0, 1000);
      expect(breakdown.unitCostCents).toBe(0);
    });

    it('should return 0 when units is negative', () => {
      const breakdown = new CostBreakdown(-5, 1000);
      expect(breakdown.unitCostCents).toBe(0);
    });

    it('should handle negative total cost correctly', () => {
      const breakdown = new CostBreakdown(10, -1000);
      expect(breakdown.unitCostCents).toBe(-100);
    });

    it('should return 0 if null or undefined inputs are bypassed via TypeScript (as any)', () => {
      const breakdown = new CostBreakdown(null as any, 1000);
      expect(breakdown.unitCostCents).toBe(0); // Since null > 0 is false, it returns 0. Wait, null > 0 is false.

      const breakdownUndefined = new CostBreakdown(undefined as any, 1000);
      expect(breakdownUndefined.unitCostCents).toBe(0); // undefined > 0 is false, it returns 0.
    });

    it('should correctly handle NaN and Infinity inputs', () => {
      const breakdownNaNUnits = new CostBreakdown(NaN, 1000);
      expect(breakdownNaNUnits.unitCostCents).toBe(0); // NaN > 0 is false

      const breakdownNaNCost = new CostBreakdown(10, NaN);
      expect(breakdownNaNCost.unitCostCents).toBeNaN();

      const breakdownInfinityUnits = new CostBreakdown(Infinity, 1000);
      expect(breakdownInfinityUnits.unitCostCents).toBe(0);

      const breakdownInfinityCost = new CostBreakdown(10, Infinity);
      expect(breakdownInfinityCost.unitCostCents).toBe(Infinity);
    });

    it('should correctly handle string inputs bypassed via TypeScript (as any)', () => {
      const breakdownStringUnits = new CostBreakdown("10" as any, 1000);
      expect(breakdownStringUnits.unitCostCents).toBe(100);

      const breakdownStringCost = new CostBreakdown(10, "1000" as any);
      expect(breakdownStringCost.unitCostCents).toBe(100);

      const breakdownInvalidStringUnits = new CostBreakdown("abc" as any, 1000);
      expect(breakdownInvalidStringUnits.unitCostCents).toBe(0); // "abc" > 0 is false
    });

    it('should correctly handle extreme values (Number.MAX_SAFE_INTEGER)', () => {
      const breakdownExtremeUnits = new CostBreakdown(Number.MAX_SAFE_INTEGER, 1000);
      expect(breakdownExtremeUnits.unitCostCents).toBe(0);

      const breakdownExtremeCost = new CostBreakdown(10, Number.MAX_SAFE_INTEGER);
      expect(breakdownExtremeCost.unitCostCents).toBe(Math.round(Number.MAX_SAFE_INTEGER / 10));
    });
  });
});
