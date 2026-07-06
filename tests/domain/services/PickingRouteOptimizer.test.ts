import { PickingRouteOptimizer, PickItemInput } from "../../../src/domain/services/PickingRouteOptimizer";
import { IWarehouseLocationRepository } from "../../../src/domain/repositories/IWarehouseLocationRepository";
import { WarehouseLocation } from "../../../src/domain/product/entities/WarehouseLocation";
import { LocationId } from "../../../src/domain/valueObjects/LocationId";

describe("PickingRouteOptimizer", () => {
  let mockLocationRepo: jest.Mocked<IWarehouseLocationRepository>;
  let optimizer: PickingRouteOptimizer;

  beforeEach(() => {
    mockLocationRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    };
    optimizer = new PickingRouteOptimizer(mockLocationRepo);
  });

  it("should return an empty array if inputs are empty", async () => {
    const result = await optimizer.optimizeRoute([]);
    expect(result).toEqual([]);
  });

  it("should throw an error if a location is not found", async () => {
    mockLocationRepo.findById.mockResolvedValue(null);
    const input: PickItemInput[] = [{ sku: "SKU1", quantity: 1, locationId: "WH1-A1" }];
    await expect(optimizer.optimizeRoute(input)).rejects.toThrow("Warehouse location with ID WH1-A1 not found.");
  });

  it("should group items by warehouse ID and sort correctly", async () => {
    const loc1 = WarehouseLocation.parsePath("WH1-Z1-1-R1-S1-B1");
    const loc2 = WarehouseLocation.parsePath("WH1-Z1-2-R1-S1-B1");
    const loc3 = WarehouseLocation.parsePath("WH2-Z1-1-R1-S1-B1");

    mockLocationRepo.findById.mockImplementation(async (id: LocationId) => {
      if (id.value === loc1.id.value) return loc1;
      if (id.value === loc2.id.value) return loc2;
      if (id.value === loc3.id.value) return loc3;
      return null;
    });

    const input: PickItemInput[] = [
      { sku: "SKU1", quantity: 1, locationId: loc2.id.value },
      { sku: "SKU2", quantity: 2, locationId: loc1.id.value },
      { sku: "SKU3", quantity: 3, locationId: loc3.id.value },
    ];

    const result = await optimizer.optimizeRoute(input);

    expect(result).toHaveLength(2);

    const wh1Route = result.find(r => r.warehouseId === "WH1");
    expect(wh1Route).toBeDefined();
    expect(wh1Route?.items).toHaveLength(2);
    // Should be sorted by aisle: aisle 1 then aisle 2
    expect(wh1Route?.items[0].sku).toBe("SKU2");
    expect(wh1Route?.items[1].sku).toBe("SKU1");

    const wh2Route = result.find(r => r.warehouseId === "WH2");
    expect(wh2Route).toBeDefined();
    expect(wh2Route?.items).toHaveLength(1);
    expect(wh2Route?.items[0].sku).toBe("SKU3");
  });

  it("should apply S-Shape serpentine direction logic for sorting within the same aisle", async () => {
    // Odd aisle (1): ascending sort (rack, then shelf, then bin)
    const locOdd1 = WarehouseLocation.parsePath("WH1-Z1-1-R1-S1-B1");
    const locOdd2 = WarehouseLocation.parsePath("WH1-Z1-1-R2-S1-B1");
    const locOdd3 = WarehouseLocation.parsePath("WH1-Z1-1-R2-S2-B1");

    // Even aisle (2): descending sort (rack, then shelf, then bin)
    const locEven1 = WarehouseLocation.parsePath("WH1-Z1-2-R1-S1-B1");
    const locEven2 = WarehouseLocation.parsePath("WH1-Z1-2-R2-S1-B1");
    const locEven3 = WarehouseLocation.parsePath("WH1-Z1-2-R2-S2-B1");

    mockLocationRepo.findById.mockImplementation(async (id: LocationId) => {
      const map: Record<string, WarehouseLocation> = {
        [locOdd1.id.value]: locOdd1,
        [locOdd2.id.value]: locOdd2,
        [locOdd3.id.value]: locOdd3,
        [locEven1.id.value]: locEven1,
        [locEven2.id.value]: locEven2,
        [locEven3.id.value]: locEven3,
      };
      return map[id.value] || null;
    });

    const input: PickItemInput[] = [
      { sku: "SKU_ODD_3", quantity: 1, locationId: locOdd3.id.value },
      { sku: "SKU_ODD_1", quantity: 1, locationId: locOdd1.id.value },
      { sku: "SKU_ODD_2", quantity: 1, locationId: locOdd2.id.value },

      { sku: "SKU_EVEN_3", quantity: 1, locationId: locEven3.id.value },
      { sku: "SKU_EVEN_1", quantity: 1, locationId: locEven1.id.value },
      { sku: "SKU_EVEN_2", quantity: 1, locationId: locEven2.id.value },
    ];

    const result = await optimizer.optimizeRoute(input);

    expect(result).toHaveLength(1);
    expect(result[0].warehouseId).toBe("WH1");
    expect(result[0].items).toHaveLength(6);

    // Sorted by Aisle (1 then 2)
    // Within Aisle 1 (odd): ascending -> SKU_ODD_1, SKU_ODD_2, SKU_ODD_3
    expect(result[0].items[0].sku).toBe("SKU_ODD_1");
    expect(result[0].items[1].sku).toBe("SKU_ODD_2");
    expect(result[0].items[2].sku).toBe("SKU_ODD_3");

    // Within Aisle 2 (even): descending -> SKU_EVEN_3, SKU_EVEN_2, SKU_EVEN_1
    expect(result[0].items[3].sku).toBe("SKU_EVEN_3");
    expect(result[0].items[4].sku).toBe("SKU_EVEN_2");
    expect(result[0].items[5].sku).toBe("SKU_EVEN_1");
  });

  it("should extract aisle index correctly using fallback alphabetical letters", async () => {
     // Aisle "A" is index 1 (odd -> ascending)
     // Aisle "B" is index 2 (even -> descending)
     const locA1 = WarehouseLocation.parsePath("WH1-Z1-A-R1-S1-B1");
     const locA2 = WarehouseLocation.parsePath("WH1-Z1-A-R2-S1-B1");
     const locB1 = WarehouseLocation.parsePath("WH1-Z1-B-R1-S1-B1");
     const locB2 = WarehouseLocation.parsePath("WH1-Z1-B-R2-S1-B1");

     mockLocationRepo.findById.mockImplementation(async (id: LocationId) => {
      const map: Record<string, WarehouseLocation> = {
        [locA1.id.value]: locA1,
        [locA2.id.value]: locA2,
        [locB1.id.value]: locB1,
        [locB2.id.value]: locB2,
      };
      return map[id.value] || null;
    });

    const input: PickItemInput[] = [
      { sku: "B1", quantity: 1, locationId: locB1.id.value },
      { sku: "B2", quantity: 1, locationId: locB2.id.value },
      { sku: "A2", quantity: 1, locationId: locA2.id.value },
      { sku: "A1", quantity: 1, locationId: locA1.id.value },
    ];

    const result = await optimizer.optimizeRoute(input);

    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(4);

    expect(result[0].items[0].sku).toBe("A1");
    expect(result[0].items[1].sku).toBe("A2");
    expect(result[0].items[2].sku).toBe("B2");
    expect(result[0].items[3].sku).toBe("B1");
  });

  it("should sort correctly when rack and shelf are the same but bin differs", async () => {
    const locEvenBin1 = WarehouseLocation.parsePath("WH1-Z1-2-R1-S1-B1");
    const locEvenBin2 = WarehouseLocation.parsePath("WH1-Z1-2-R1-S1-B2");

    mockLocationRepo.findById.mockImplementation(async (id: LocationId) => {
      if (id.value === locEvenBin1.id.value) return locEvenBin1;
      if (id.value === locEvenBin2.id.value) return locEvenBin2;
      return null;
    });

    const input: PickItemInput[] = [
      { sku: "SKU_BIN_2", quantity: 1, locationId: locEvenBin2.id.value },
      { sku: "SKU_BIN_1", quantity: 1, locationId: locEvenBin1.id.value },
    ];

    const result = await optimizer.optimizeRoute(input);
    expect(result[0].items[0].sku).toBe("SKU_BIN_2"); // Descending, so B2 comes before B1
    expect(result[0].items[1].sku).toBe("SKU_BIN_1");
  });

  it("should sort correctly when rack and shelf are the same but bin differs (odd aisle)", async () => {
    const locOddBin1 = WarehouseLocation.parsePath("WH1-Z1-1-R1-S1-B1");
    const locOddBin2 = WarehouseLocation.parsePath("WH1-Z1-1-R1-S1-B2");

    mockLocationRepo.findById.mockImplementation(async (id: LocationId) => {
      if (id.value === locOddBin1.id.value) return locOddBin1;
      if (id.value === locOddBin2.id.value) return locOddBin2;
      return null;
    });

    const input: PickItemInput[] = [
      { sku: "SKU_BIN_2", quantity: 1, locationId: locOddBin2.id.value },
      { sku: "SKU_BIN_1", quantity: 1, locationId: locOddBin1.id.value },
    ];

    const result = await optimizer.optimizeRoute(input);
    expect(result[0].items[0].sku).toBe("SKU_BIN_1"); // Ascending, so B1 comes before B2
    expect(result[0].items[1].sku).toBe("SKU_BIN_2");
  });

  it("should extract aisle index correctly using fallback 1 if aisle has no letters and no numbers", async () => {
    const loc1 = WarehouseLocation.parsePath("WH1-Z1-@-R1-S1-B1");
    const loc2 = WarehouseLocation.parsePath("WH1-Z1-@-R1-S1-B2");

    mockLocationRepo.findById.mockImplementation(async (id: LocationId) => {
      if (id.value === loc1.id.value) return loc1;
      if (id.value === loc2.id.value) return loc2;
      return null;
    });

    const input: PickItemInput[] = [
      { sku: "SKU_BIN_2", quantity: 1, locationId: loc2.id.value },
      { sku: "SKU_BIN_1", quantity: 1, locationId: loc1.id.value },
    ];

    const result = await optimizer.optimizeRoute(input);
    // Aisle defaults to 1 (odd), meaning ascending. So B1 comes before B2.
    expect(result[0].items[0].sku).toBe("SKU_BIN_1");
    expect(result[0].items[1].sku).toBe("SKU_BIN_2");
  });
});
