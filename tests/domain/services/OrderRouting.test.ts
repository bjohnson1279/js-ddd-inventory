import { OrderRoutingService, Warehouse, OrderLine, Coordinates } from "../../../src/domain/services/OrderRoutingService";

describe("OrderRoutingService", () => {
  let service: OrderRoutingService;
  let warehouses: Warehouse[];
  let destination: Coordinates;

  beforeEach(() => {
    service = new OrderRoutingService();
    destination = { latitude: 40.7128, longitude: -74.0060 }; // New York City

    warehouses = [
      {
        id: "WH-NEAR",
        name: "Near Warehouse",
        latitude: 40.7306,
        longitude: -73.9352, // Brooklyn (~7 miles away)
        inventory: new Map([
          ["SKU-A", 10],
          ["SKU-B", 5]
        ]),
        baseShippingFeeCents: 500,
        shippingCostPerMileCents: 10
      },
      {
        id: "WH-FAR",
        name: "Far Warehouse",
        latitude: 34.0522,
        longitude: -118.2437, // Los Angeles (~2400 miles away)
        inventory: new Map([
          ["SKU-A", 20],
          ["SKU-B", 20],
          ["SKU-C", 10]
        ]),
        baseShippingFeeCents: 800,
        shippingCostPerMileCents: 5
      }
    ];
  });

  it("should prefer the closer warehouse if it can fulfill the entire order", () => {
    const orderLines: OrderLine[] = [
      { sku: "SKU-A", quantity: 5 },
      { sku: "SKU-B", quantity: 2 }
    ];

    const result = service.routeOrder(orderLines, destination, warehouses);

    expect(result.splitCount).toBe(1);
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0].warehouseId).toBe("WH-NEAR");
    expect(result.allocations[1].warehouseId).toBe("WH-NEAR");
    expect(result.totalCostCents).toBeLessThan(1000); // 500 + ~7 * 10 = ~570
  });

  it("should avoid split when consolidating at one warehouse is cheaper", () => {
    const orderLines: OrderLine[] = [
      { sku: "SKU-A", quantity: 5 },
      { sku: "SKU-C", quantity: 3 }
    ];

    const result = service.routeOrder(orderLines, destination, warehouses);

    // Consolidated shipping from WH-FAR is cheaper than splitting (avoiding WH-NEAR base fee)
    expect(result.splitCount).toBe(1);
    expect(result.allocations[0].warehouseId).toBe("WH-FAR");
    expect(result.allocations[1].warehouseId).toBe("WH-FAR");
  });

  it("should split the order when no single warehouse has inventory to satisfy all items", () => {
    // Remove SKU-A from WH-FAR so a split is forced
    warehouses[1].inventory.delete("SKU-A");

    const orderLines: OrderLine[] = [
      { sku: "SKU-A", quantity: 5 },
      { sku: "SKU-C", quantity: 3 }
    ];

    const result = service.routeOrder(orderLines, destination, warehouses);

    expect(result.splitCount).toBe(2);
    const nearAlloc = result.allocations.find(a => a.warehouseId === "WH-NEAR");
    const farAlloc = result.allocations.find(a => a.warehouseId === "WH-FAR");

    expect(nearAlloc).toBeDefined();
    expect(nearAlloc!.sku).toBe("SKU-A");
    expect(farAlloc).toBeDefined();
    expect(farAlloc!.sku).toBe("SKU-C");
  });

  it("should split quantities of a single line if needed to fulfill total quantity", () => {
    const orderLines: OrderLine[] = [
      { sku: "SKU-A", quantity: 25 } // 10 at WH-NEAR, 20 at WH-FAR
    ];

    const result = service.routeOrder(orderLines, destination, warehouses);

    expect(result.splitCount).toBe(2);
    const nearAlloc = result.allocations.find(a => a.warehouseId === "WH-NEAR" && a.sku === "SKU-A");
    const farAlloc = result.allocations.find(a => a.warehouseId === "WH-FAR" && a.sku === "SKU-A");

    expect(nearAlloc).toBeDefined();
    expect(nearAlloc!.quantity).toBe(10);
    expect(farAlloc).toBeDefined();
    expect(farAlloc!.quantity).toBe(15);
  });

  it("should throw an error when total inventory is insufficient", () => {
    const orderLines: OrderLine[] = [
      { sku: "SKU-A", quantity: 50 }
    ];

    expect(() => {
      service.routeOrder(orderLines, destination, warehouses);
    }).toThrow(/Unable to fulfill order/);
  });
});
