import { CostLayerService } from "../../../src/domain/accounting/services/CostLayerService";
import { InMemoryCostLayerRepository } from "../../../src/infrastructure/database/InMemoryCostLayerRepository";
import { InventoryCostLayer } from "../../../src/domain/accounting/entities/InventoryCostLayer";
import { InsufficientInventoryException } from "../../../src/domain/exceptions/InsufficientInventoryException";

describe("Cost Layer Valuations (FIFO & WAC)", () => {
  let repository: InMemoryCostLayerRepository;
  let service: CostLayerService;

  beforeEach(() => {
    repository = new InMemoryCostLayerRepository();
    service = new CostLayerService(repository);
  });

  it("should calculate and consume cost layers using FIFO (oldest first)", async () => {
    const now = Date.now();
    // Layer 1: 5 units at $10.00 each (older)
    const layer1 = new InventoryCostLayer("L1", "VAR-A", "TEN-1", 5, 1000, new Date(now - 10000), "PO-1");
    // Layer 2: 10 units at $12.00 each (newer)
    const layer2 = new InventoryCostLayer("L2", "VAR-A", "TEN-1", 10, 1200, new Date(now), "PO-2");

    await repository.save(layer1);
    await repository.save(layer2);

    // Calculate FIFO cost for 8 units: needs 5 from L1 ($50.00) + 3 from L2 ($36.00) = $86.00
    const calcCost = await service.calculateFifoCost("VAR-A", 8);
    expect(calcCost.totalCostCents).toBe(8600);
    expect(calcCost.unitCostCents).toBe(1075); // 8600 / 8

    // Calculation should have no side-effects on remaining quantities
    expect(layer1.remainingQuantity).toBe(5);

    // Consume layers
    const consumedCost = await service.consumeFifoLayers("VAR-A", 8);
    expect(consumedCost.totalCostCents).toBe(8600);

    // Quantities should be updated in database
    const activeLayers = await repository.getActiveLayers("VAR-A", "asc");
    expect(activeLayers.length).toBe(1); // Layer 1 is exhausted
    expect(activeLayers[0].id).toBe("L2");
    expect(activeLayers[0].remainingQuantity).toBe(7); // 10 - 3 = 7
  });

  it("should calculate cost using Weighted Average Cost", async () => {
    const now = Date.now();
    const layer1 = new InventoryCostLayer("L1", "VAR-A", "TEN-1", 5, 1000, new Date(now - 10000), "PO-1");
    const layer2 = new InventoryCostLayer("L2", "VAR-A", "TEN-1", 10, 1300, new Date(now), "PO-2");

    await repository.save(layer1);
    await repository.save(layer2);

    // Total: 15 units, Value: 5 * 1000 + 10 * 1300 = 18000 cents.
    // Average unit cost: 18000 / 15 = 1200 cents.
    // WAC for 4 units should be 4 * 1200 = 4800 cents.
    const wacCost = await service.calculateWeightedAverageCost("VAR-A", 4);
    expect(wacCost.totalCostCents).toBe(4800);
    expect(wacCost.unitCostCents).toBe(1200);
  });

  it("should throw InsufficientInventoryException if not enough layers are active", async () => {
    const now = Date.now();
    const layer1 = new InventoryCostLayer("L1", "VAR-A", "TEN-1", 2, 1000, new Date(now), "PO-1");
    await repository.save(layer1);

    await expect(service.calculateFifoCost("VAR-A", 5)).rejects.toThrow(InsufficientInventoryException);
    await expect(service.calculateWeightedAverageCost("VAR-A", 5)).rejects.toThrow(InsufficientInventoryException);
  });
});
