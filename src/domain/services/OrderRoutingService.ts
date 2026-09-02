export interface OrderLine {
  sku: string;
  quantity: number;
}

export interface Warehouse {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  inventory: Map<string, number>; // SKU -> quantity
  baseShippingFeeCents: number;
  shippingCostPerMileCents: number;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RouteAllocation {
  warehouseId: string;
  sku: string;
  quantity: number;
}

export interface OrderRoutingResult {
  allocations: RouteAllocation[];
  totalCostCents: number;
  splitCount: number;
}

export class OrderRoutingService {
  public routeOrder(
    orderLines: OrderLine[],
    destination: Coordinates,
    warehouses: Warehouse[]
  ): OrderRoutingResult {
    if (orderLines.length === 0) {
      return { allocations: [], totalCostCents: 0, splitCount: 0 };
    }

    // 1. Calculate distance from each warehouse to destination
    const warehouseDistances = new Map<string, number>();
    for (const wh of warehouses) {
      const distance = this.calculateDistance(
        wh.latitude,
        wh.longitude,
        destination.latitude,
        destination.longitude
      );
      warehouseDistances.set(wh.id, distance);
    }

    // 2. We want to find the optimal allocation.
    let bestResult: OrderRoutingResult | null = null;

    const findAllocation = (
      lineIndex: number,
      currentAllocations: RouteAllocation[],
      tempInventories: Map<string, Map<string, number>>
    ) => {
      if (lineIndex === orderLines.length) {
        // Evaluate current allocations
        const result = this.evaluateAllocations(currentAllocations, warehouses, warehouseDistances);
        if (result && (!bestResult || result.totalCostCents < bestResult.totalCostCents)) {
          bestResult = result;
        }
        return;
      }

      const line = orderLines[lineIndex];
      const sku = line.sku;
      const targetQty = line.quantity;

      // Find warehouses that have inventory for this SKU in tempInventories
      const eligibleWarehouses = warehouses.filter(wh => {
        const whInv = tempInventories.get(wh.id);
        return (whInv?.get(sku) || 0) > 0;
      });

      // Backtracking helper to distribute quantity of the current line
      const distribute = (
        whIndex: number,
        remainingQty: number,
        lineAllocations: RouteAllocation[]
      ) => {
        if (remainingQty === 0) {
          // Commit temp inventory for the next line
          const nextInventories = new Map<string, Map<string, number>>();
          for (const [whId, inv] of tempInventories.entries()) {
            nextInventories.set(whId, new Map(inv));
          }
          for (const alloc of lineAllocations) {
            const whInv = nextInventories.get(alloc.warehouseId)!;
            whInv.set(sku, whInv.get(sku)! - alloc.quantity);
          }

          findAllocation(lineIndex + 1, [...currentAllocations, ...lineAllocations], nextInventories);
          return;
        }

        if (whIndex === eligibleWarehouses.length) {
          return; // Path cannot fully satisfy remainingQty
        }

        const wh = eligibleWarehouses[whIndex];
        const whInv = tempInventories.get(wh.id)!;
        const available = whInv.get(sku) || 0;

        const maxAllocatable = Math.min(remainingQty, available);
        for (let qty = maxAllocatable; qty >= 0; qty--) {
          if (qty > 0) {
            distribute(whIndex + 1, remainingQty - qty, [
              ...lineAllocations,
              { warehouseId: wh.id, sku, quantity: qty }
            ]);
          } else {
            distribute(whIndex + 1, remainingQty, lineAllocations);
          }
        }
      };

      distribute(0, targetQty, []);
    };

    // Initialize temp inventories clone
    const initialInventories = new Map<string, Map<string, number>>();
    for (const wh of warehouses) {
      initialInventories.set(wh.id, new Map(wh.inventory));
    }

    findAllocation(0, [], initialInventories);

    if (!bestResult) {
      throw new Error("Unable to fulfill order: Insufficient stock across all warehouses.");
    }

    return bestResult;
  }

  private evaluateAllocations(
    allocations: RouteAllocation[],
    warehouses: Warehouse[],
    warehouseDistances: Map<string, number>
  ): OrderRoutingResult | null {
    // Group allocations by warehouse
    const warehouseGroups = new Map<string, RouteAllocation[]>();
    for (const alloc of allocations) {
      const list = warehouseGroups.get(alloc.warehouseId) || [];
      list.push(alloc);
      warehouseGroups.set(alloc.warehouseId, list);
    }

    const splitCount = warehouseGroups.size;
    let totalCostCents = 0;

    for (const [whId] of warehouseGroups.entries()) {
      const wh = warehouses.find(w => w.id === whId)!;
      const distance = warehouseDistances.get(whId) || 0;

      // Cost = base shipping fee + (distance * cost per mile)
      const shippingCost = wh.baseShippingFeeCents + Math.round(distance * wh.shippingCostPerMileCents);
      totalCostCents += shippingCost;
    }

    return {
      allocations,
      totalCostCents,
      splitCount
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.8; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
