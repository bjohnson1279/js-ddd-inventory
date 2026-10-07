import { CostLayerService } from "../../../src/domain/accounting/services/CostLayerService";
import { InMemoryCostLayerRepository } from "../../../src/infrastructure/database/InMemoryCostLayerRepository";
import { InventoryCostLayer } from "../../../src/domain/accounting/entities/InventoryCostLayer";
import { CostingMethod } from "../../../src/domain/accounting/enums/CostingMethod";
import { InsufficientInventoryException } from "../../../src/domain/exceptions/InsufficientInventoryException";
import { ICostLayerRepository } from "../../../src/domain/repositories/ICostLayerRepository";

describe("CostLayerService", () => {
  let repository: InMemoryCostLayerRepository;
  let service: CostLayerService;

  beforeEach(() => {
    repository = new InMemoryCostLayerRepository();
    service = new CostLayerService(repository);
  });

  describe("Single Item Cost Calculation and Consumption", () => {
    it("should calculate cost using default FIFO without mutating layer state", async () => {
      const now = Date.now();
      const layer1 = new InventoryCostLayer("L1", "VAR-1", "TENANT-1", 10, 1000, new Date(now - 10000), "PO-1");
      const layer2 = new InventoryCostLayer("L2", "VAR-1", "TENANT-1", 10, 1200, new Date(now), "PO-2");
      await repository.save(layer1);
      await repository.save(layer2);

      const breakdown = await service.calculateCost("VAR-1", 5);

      expect(breakdown.totalCostCents).toBe(5000);
      expect(breakdown.unitCostCents).toBe(1000);
      expect(layer1.remainingQuantity).toBe(10);
      expect(layer2.remainingQuantity).toBe(10);
    });

    it("should consume layers using FIFO and persist changes", async () => {
      const now = Date.now();
      const layer1 = new InventoryCostLayer("L1", "VAR-1", "TENANT-1", 5, 1000, new Date(now - 10000), "PO-1");
      const layer2 = new InventoryCostLayer("L2", "VAR-1", "TENANT-1", 10, 1200, new Date(now), "PO-2");
      await repository.save(layer1);
      await repository.save(layer2);

      const breakdown = await service.consumeLayers("VAR-1", 8, CostingMethod.FIFO);

      expect(breakdown.totalCostCents).toBe(5000 + 3600); // 5 * 1000 + 3 * 1200 = 8600
      expect(layer1.remainingQuantity).toBe(0);
      expect(layer2.remainingQuantity).toBe(7);

      const activeLayers = await repository.getActiveLayers("VAR-1");
      expect(activeLayers).toHaveLength(1);
      expect(activeLayers[0].id).toBe("L2");
      expect(activeLayers[0].remainingQuantity).toBe(7);
    });

    it("should handle backwards compatibility helper methods (calculateFifoCost, consumeFifoLayers, calculateWeightedAverageCost)", async () => {
      const now = Date.now();
      const layer1 = new InventoryCostLayer("L1", "VAR-1", "TENANT-1", 10, 1000, new Date(now - 10000), "PO-1");
      const layer2 = new InventoryCostLayer("L2", "VAR-1", "TENANT-1", 10, 2000, new Date(now), "PO-2");
      await repository.save(layer1);
      await repository.save(layer2);

      const fifoCalc = await service.calculateFifoCost("VAR-1", 5);
      expect(fifoCalc.totalCostCents).toBe(5000);

      const wacCalc = await service.calculateWeightedAverageCost("VAR-1", 10);
      // Average: (10*1000 + 10*2000)/20 = 1500 per unit. 10 units = 15000
      expect(wacCalc.totalCostCents).toBe(15000);

      const fifoConsumed = await service.consumeFifoLayers("VAR-1", 5);
      expect(fifoConsumed.totalCostCents).toBe(5000);
      expect(layer1.remainingQuantity).toBe(5);
    });

    it("should throw InsufficientInventoryException when requested quantity exceeds available stock", async () => {
      const layer1 = new InventoryCostLayer("L1", "VAR-1", "TENANT-1", 3, 1000, new Date(), "PO-1");
      await repository.save(layer1);

      await expect(service.calculateCost("VAR-1", 5)).rejects.toThrow(
        InsufficientInventoryException
      );
      await expect(service.consumeLayers("VAR-1", 5)).rejects.toThrow(
        InsufficientInventoryException
      );
    });
  });

  describe("Batch Cost Calculation and Consumption", () => {
    it("should consume layers in batch and persist only modified layers", async () => {
      const now = Date.now();
      const layerA1 = new InventoryCostLayer("LA1", "VAR-A", "TENANT-1", 10, 1000, new Date(now - 10000), "PO-1");
      const layerA2 = new InventoryCostLayer("LA2", "VAR-A", "TENANT-1", 10, 1200, new Date(now), "PO-2");
      const layerB1 = new InventoryCostLayer("LB1", "VAR-B", "TENANT-1", 5, 2000, new Date(now), "PO-3");

      await repository.save(layerA1);
      await repository.save(layerA2);
      await repository.save(layerB1);

      const batchComponents = [
        { variantId: "VAR-A", quantity: 12 },
        { variantId: "VAR-B", quantity: 3 },
      ];

      const breakdowns = await service.consumeLayersBatch(batchComponents, CostingMethod.FIFO);

      expect(breakdowns).toHaveLength(2);
      expect(breakdowns[0].totalCostCents).toBe(10 * 1000 + 2 * 1200); // 12400
      expect(breakdowns[1].totalCostCents).toBe(3 * 2000); // 6000

      expect(layerA1.remainingQuantity).toBe(0);
      expect(layerA2.remainingQuantity).toBe(8);
      expect(layerB1.remainingQuantity).toBe(2);
    });

    it("should use consumeFifoLayersBatch helper method", async () => {
      const layerA1 = new InventoryCostLayer("LA1", "VAR-A", "TENANT-1", 10, 1000, new Date(), "PO-1");
      await repository.save(layerA1);

      const breakdowns = await service.consumeFifoLayersBatch([
        { variantId: "VAR-A", quantity: 4 },
      ]);

      expect(breakdowns).toHaveLength(1);
      expect(breakdowns[0].totalCostCents).toBe(4000);
      expect(layerA1.remainingQuantity).toBe(6);
    });

    it("should calculate layers in batch without modifying inventory state", async () => {
      const layerA1 = new InventoryCostLayer("LA1", "VAR-A", "TENANT-1", 10, 1000, new Date(), "PO-1");
      const layerB1 = new InventoryCostLayer("LB1", "VAR-B", "TENANT-1", 10, 1500, new Date(), "PO-2");
      await repository.save(layerA1);
      await repository.save(layerB1);

      const breakdowns = await service.calculateLayersBatch(
        [
          { variantId: "VAR-A", quantity: 5 },
          { variantId: "VAR-B", quantity: 5 },
        ],
        CostingMethod.FIFO
      );

      expect(breakdowns).toHaveLength(2);
      expect(breakdowns[0].totalCostCents).toBe(5000);
      expect(breakdowns[1].totalCostCents).toBe(7500);

      expect(layerA1.remainingQuantity).toBe(10);
      expect(layerB1.remainingQuantity).toBe(10);
    });

    it("should use calculateWeightedAverageCostBatch helper method", async () => {
      const layerA1 = new InventoryCostLayer("LA1", "VAR-A", "TENANT-1", 10, 1000, new Date(), "PO-1");
      await repository.save(layerA1);

      const breakdowns = await service.calculateWeightedAverageCostBatch([
        { variantId: "VAR-A", quantity: 5 },
      ]);

      expect(breakdowns).toHaveLength(1);
      expect(breakdowns[0].totalCostCents).toBe(5000);
    });

    it("should fall back to Promise.all when repository lacks getActiveLayersByVariantIds", async () => {
      const layerA1 = new InventoryCostLayer("LA1", "VAR-A", "TENANT-1", 10, 1000, new Date(), "PO-1");
      const layerB1 = new InventoryCostLayer("LB1", "VAR-B", "TENANT-1", 10, 2000, new Date(), "PO-2");

      // Create a mock repository WITHOUT getActiveLayersByVariantIds
      const customRepo: ICostLayerRepository = {
        getActiveLayers: jest.fn().mockImplementation(async (vId: string) => {
          if (vId === "VAR-A") return [layerA1];
          if (vId === "VAR-B") return [layerB1];
          return [];
        }),
        save: jest.fn().mockResolvedValue(undefined),
        saveMany: jest.fn().mockResolvedValue(undefined),
      };

      const customService = new CostLayerService(customRepo);

      const batchComponents = [
        { variantId: "VAR-A", quantity: 2 },
        { variantId: "VAR-B", quantity: 3 },
      ];

      const batchCalculations = await customService.calculateLayersBatch(batchComponents);
      expect(batchCalculations).toHaveLength(2);
      expect(batchCalculations[0].totalCostCents).toBe(2000);
      expect(batchCalculations[1].totalCostCents).toBe(6000);

      const batchConsumptions = await customService.consumeLayersBatch(batchComponents);
      expect(batchConsumptions).toHaveLength(2);
      expect(layerA1.remainingQuantity).toBe(8);
      expect(layerB1.remainingQuantity).toBe(7);
      expect(customRepo.saveMany).toHaveBeenCalledWith([layerA1, layerB1]);
    });

    it("should handle empty batch or empty components array gracefully", async () => {
      const breakdowns = await service.consumeLayersBatch([]);
      expect(breakdowns).toEqual([]);

      const calcBreakdowns = await service.calculateLayersBatch([]);
      expect(calcBreakdowns).toEqual([]);
    });

    it("should handle multiple components for the same variant ID in batch", async () => {
      const layer1 = new InventoryCostLayer("L1", "VAR-1", "TENANT-1", 20, 1000, new Date(), "PO-1");
      await repository.save(layer1);

      const breakdowns = await service.consumeLayersBatch([
        { variantId: "VAR-1", quantity: 5 },
        { variantId: "VAR-1", quantity: 10 },
      ]);

      expect(breakdowns).toHaveLength(2);
      expect(breakdowns[0].totalCostCents).toBe(5000);
      expect(breakdowns[1].totalCostCents).toBe(10000);
      expect(layer1.remainingQuantity).toBe(5);
    });
  });
});
