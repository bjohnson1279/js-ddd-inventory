import { AutonomousInventoryEngine } from '../../../src/application/autonomous/AutonomousInventoryEngine';

describe('AutonomousInventoryEngine', () => {
  let engine: AutonomousInventoryEngine;

  beforeEach(() => {
    engine = new AutonomousInventoryEngine();
  });

  describe('runRebalanceRoutine', () => {
    it('should generate no tasks when all stock levels are sufficient', () => {
      const inventoryData = [
        { sku: 'SKU-1', stock: 10, minStock: 5 },
        { sku: 'SKU-2', stock: 20, minStock: 20 },
      ];

      const tasks = engine.runRebalanceRoutine(inventoryData);

      expect(tasks).toHaveLength(0);
    });

    it('should generate a task when stock level is below minimum', () => {
      const inventoryData = [
        { sku: 'SKU-1', stock: 3, minStock: 5 },
      ];

      const tasks = engine.runRebalanceRoutine(inventoryData);

      expect(tasks).toHaveLength(1);

      const task = tasks[0];
      expect(task.sku).toBe('SKU-1');
      expect(task.action).toBe('AUTO_REORDER');
      expect(task.quantity).toBe(7); // minStock * 2 - stock = 5 * 2 - 3 = 7
      expect(task.status).toBe('PENDING_APPROVAL');
      expect(task.id).toMatch(/^task-\d+-\d+$/);
      expect(new Date(task.timestamp).getTime()).not.toBeNaN();
    });

    it('should generate multiple tasks when multiple stock levels are below minimum', () => {
      const inventoryData = [
        { sku: 'SKU-1', stock: 3, minStock: 5 },
        { sku: 'SKU-2', stock: 10, minStock: 5 }, // Sufficient
        { sku: 'SKU-3', stock: 1, minStock: 10 },
      ];

      const tasks = engine.runRebalanceRoutine(inventoryData);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].sku).toBe('SKU-1');
      expect(tasks[0].quantity).toBe(7);

      expect(tasks[1].sku).toBe('SKU-3');
      expect(tasks[1].quantity).toBe(19); // 10 * 2 - 1 = 19
    });

    it('should handle empty inventory data', () => {
      const tasks = engine.runRebalanceRoutine([]);
      expect(tasks).toHaveLength(0);
    });

    it('should not generate a task if stock equals minStock', () => {
      const inventoryData = [
        { sku: 'SKU-1', stock: 5, minStock: 5 },
      ];
      const tasks = engine.runRebalanceRoutine(inventoryData);
      expect(tasks).toHaveLength(0);
    });

    it('should handle negative stock values', () => {
      const inventoryData = [
        { sku: 'SKU-1', stock: -2, minStock: 5 },
      ];
      const tasks = engine.runRebalanceRoutine(inventoryData);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].quantity).toBe(12); // 5 * 2 - (-2) = 12
    });
  });
});
