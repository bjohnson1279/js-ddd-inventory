import { CRDTStockResolver, LWWElement } from '../../../src/domain/crdt/CRDTStockResolver';

describe('CRDTStockResolver', () => {
  describe('mergeLWW', () => {
    it('should return incoming element if incoming timestamp is strictly greater', () => {
      const current: LWWElement<number> = { element: 1, timestamp: 100, nodeId: 'node-a' };
      const incoming: LWWElement<number> = { element: 2, timestamp: 200, nodeId: 'node-b' };

      const result = CRDTStockResolver.mergeLWW(current, incoming);
      expect(result).toBe(incoming);
    });

    it('should return current element if incoming timestamp is strictly less', () => {
      const current: LWWElement<number> = { element: 1, timestamp: 200, nodeId: 'node-a' };
      const incoming: LWWElement<number> = { element: 2, timestamp: 100, nodeId: 'node-b' };

      const result = CRDTStockResolver.mergeLWW(current, incoming);
      expect(result).toBe(current);
    });

    it('should return incoming element if timestamps are equal and incoming nodeId is greater', () => {
      const current: LWWElement<number> = { element: 1, timestamp: 100, nodeId: 'node-a' };
      const incoming: LWWElement<number> = { element: 2, timestamp: 100, nodeId: 'node-b' };

      const result = CRDTStockResolver.mergeLWW(current, incoming);
      expect(result).toBe(incoming);
    });

    it('should return current element if timestamps are equal and incoming nodeId is less', () => {
      const current: LWWElement<number> = { element: 1, timestamp: 100, nodeId: 'node-b' };
      const incoming: LWWElement<number> = { element: 2, timestamp: 100, nodeId: 'node-a' };

      const result = CRDTStockResolver.mergeLWW(current, incoming);
      expect(result).toBe(current);
    });

    it('should return current element if timestamps are equal and nodeIds are equal', () => {
      const current: LWWElement<number> = { element: 1, timestamp: 100, nodeId: 'node-a' };
      const incoming: LWWElement<number> = { element: 2, timestamp: 100, nodeId: 'node-a' };

      const result = CRDTStockResolver.mergeLWW(current, incoming);
      expect(result).toBe(current);
    });
  });
});
