import { GeoLocation } from "../../valueObjects/GeoLocation";
import { CandidateLocation, FulfillmentPlan, FulfillmentAllocation, IRoutingStrategy } from "../strategies/RoutingStrategy";

export class OrderRoutingEngine {
  /**
   * Evaluates all potential fulfillment plans and returns the optimal one.
   *
   * @param sku The product SKU to route.
   * @param quantity The target quantity to fulfill.
   * @param destination The target destination coordinates.
   * @param candidates All candidate warehouses with stock levels and location details.
   * @param strategy The scoring strategy (e.g. minimize splits, cost, or distance).
   * @param rateCalculator Callback to estimate carrier rates for a specific origin, SKU, and quantity.
   */
  public static async routeOrder(
    sku: string,
    quantity: number,
    destination: GeoLocation,
    candidates: { locationId: string; availableQuantity: number; geoLocation: GeoLocation }[],
    strategy: IRoutingStrategy,
    rateCalculator: (locationId: string, sku: string, qty: number) => Promise<number>
  ): Promise<FulfillmentPlan> {

      throw new Error(`Insufficient total stock for SKU ${sku}. Requested: ${quantity}, Available: ${totalAvailable}`);
    }

    // 1. Generate combinations of allocations
    const rawPlans = this.generatePlans(activeCandidates, quantity);

    if (rawPlans.length === 0) {
      throw new Error(`Could not find any valid allocation combinations for quantity ${quantity}`);
    }

    // 2. Score and evaluate each plan
    const plans: FulfillmentPlan[] = [];
    for (const allocations of rawPlans) {
      let totalDistance = 0;
      let totalCost = 0;

      for (const alloc of allocations) {
        const candidate = activeCandidates.find(c => c.locationId === alloc.locationId)!;
        // Compute Haversine distance from origin warehouse to destination
        const dist = candidate.geoLocation.distanceTo(destination);
        totalDistance += dist;

        // Fetch carrier rate for the specific allocated quantity from this origin
        const rate = await rateCalculator(alloc.locationId, sku, alloc.quantity);
        totalCost += rate;
      }

      const splitCount = allocations.length - 1;

      const plan: FulfillmentPlan = {
        allocations,
        estimatedShippingCostCents: totalCost,
        totalDistanceKm: totalDistance,
        splitCount,
        score: 0 // Will be computed by the strategy
      };

      plan.score = strategy.score(plan);
      plans.push(plan);
    }

    // 3. Sort plans by score (lower score is better)
    plans.sort((a, b) => a.score - b.score);
    return plans[0];
  }

  /**
   * Generates candidate allocation plans using a binary search tree approach:
   * at each warehouse, we either fulfill as much as possible or skip it.
   */
  private static generatePlans(
    candidates: { locationId: string; availableQuantity: number }[],
    quantity: number
  ): FulfillmentAllocation[][] {
    const results: FulfillmentAllocation[][] = [];

    const recurse = (
      index: number,
      remaining: number,
      current: FulfillmentAllocation[]
    ) => {
      if (remaining === 0) {
        results.push([...current]);
        return;
      }
      if (index >= candidates.length) {
        return;
      }

      const candidate = candidates[index];

      // Option A: Fulfill as much as possible from this candidate
      const allocQty = Math.min(remaining, candidate.availableQuantity);
      if (allocQty > 0) {
        current.push({ locationId: candidate.locationId, quantity: allocQty });
        recurse(index + 1, remaining - allocQty, current);
        current.pop();
      }

      // Option B: Skip this candidate entirely
      recurse(index + 1, remaining, current);
    };

    recurse(0, quantity, []);
    return results;
  }
}
