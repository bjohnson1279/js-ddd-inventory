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

  it("should throw an error if required parameters are missing", async () => {
    await expect(useCase.execute({
      sku: "",
      quantity: 5,
      destinationAddress: "123 Broadway, New York, NY 10001"
    })).rejects.toThrow("Missing required routing parameters: sku, quantity, and destinationAddress.");
  });

  it("should throw an error if there is insufficient total stock", async () => {
    const sku = SKU.create("SKU-ROUTE");
    const itemEast = InventoryItem.create("item-1", sku, "WH-EAST", Quantity.create(2));
    mockInventoryRepo.findAllBySku.mockResolvedValue([itemEast]);

    await expect(useCase.execute({
      sku: "SKU-ROUTE",
      quantity: 5,
      destinationAddress: "123 Broadway, New York, NY 10001",
      strategyName: "MINIMIZE_COST"
    })).rejects.toThrow("Insufficient total stock for SKU SKU-ROUTE. Requested: 5, Available: 2");
  });

  it("should gracefully handle carrier service errors by applying a fallback high rate", async () => {
    const sku = SKU.create("SKU-ROUTE");

    // Setup stock in East and West
    const itemEast = InventoryItem.create("item-1", sku, "WH-EAST", Quantity.create(10));
    const itemWest = InventoryItem.create("item-2", sku, "WH-WEST", Quantity.create(10));
    mockInventoryRepo.findAllBySku.mockResolvedValue([itemEast, itemWest]);

    // Destination is NY. East rate fetch throws an error, West rate returns normally.
    mockCarrierService.fetchRates.mockImplementation(async (productSku, qty, dest, origin) => {
      if (origin === "WH-EAST") {
        throw new Error("Carrier API down");
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

    // Since East threw an error, it got a rate of 999999.
    // West is 4500. So West should be selected.
    expect(plan.allocations).toHaveLength(1);
    expect(plan.allocations[0].locationId).toBe("WH-WEST");
    expect(plan.estimatedShippingCostCents).toBe(4500);
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
