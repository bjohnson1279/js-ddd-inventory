import { RouteOrder } from "../../../src/application/useCases/RouteOrder";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { ICarrierService } from "../../../src/application/ports/ICarrierService";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";

describe("RouteOrder Use Case", () => {
  let mockInventoryRepo: jest.Mocked<IInventoryRepository>;
  let mockCarrierService: jest.Mocked<ICarrierService>;
  let useCase: RouteOrder;

  beforeEach(() => {
    mockInventoryRepo = {
      findAllBySku: jest.fn(),
      findBySku: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      findAllByLocation: jest.fn(),
      hasAnyEntries: jest.fn(),
    } as any;
    mockCarrierService = {
      fetchRates: jest.fn(),
      generateLabel: jest.fn(),
    } as any;

    useCase = new RouteOrder(mockInventoryRepo, mockCarrierService);
  });

  it("should successfully route an order based on nearest location and low cost", async () => {
    const sku = SKU.create("SKU-ROUTE");
    
    // Setup stock in East (NY area) and West (LA area)
    const itemEast = InventoryItem.create("item-1", sku, "WH-EAST", Quantity.create(10));
    const itemWest = InventoryItem.create("item-2", sku, "WH-WEST", Quantity.create(10));
    mockInventoryRepo.findAllBySku.mockResolvedValue([itemEast, itemWest]);

    // Destination is in NY, so East rate should be low, West rate high
    mockCarrierService.fetchRates.mockImplementation(async (productSku, qty, dest, origin) => {
      if (origin === "WH-EAST") {
        return [{ carrier: "UPS Ground", rateCents: 600, estimatedDays: 2 }];
      } else {
        return [{ carrier: "UPS Ground", rateCents: 4500, estimatedDays: 5 }];
      }
    });

    const plan = await useCase.execute({
      sku: "SKU-ROUTE",
      quantity: 5,
      destinationAddress: "123 Broadway, New York, NY 10001",
      strategyName: "MINIMIZE_COST"
    });

    expect(plan.splitCount).toBe(0);
    expect(plan.allocations).toHaveLength(1);
    expect(plan.allocations[0].locationId).toBe("WH-EAST");
    expect(plan.allocations[0].quantity).toBe(5);
    expect(plan.estimatedShippingCostCents).toBe(600);
  });
});
