import { GeoLocation } from "../../valueObjects/GeoLocation";
import { CarrierRate } from "../../../application/ports/ICarrierService";

export interface CandidateLocation {
  locationId: string;
  availableQuantity: number;
  geoLocation: GeoLocation;
  carrierRates: CarrierRate[];
}

export interface FulfillmentAllocation {
  locationId: string;
  quantity: number;
}

export interface FulfillmentPlan {
  allocations: FulfillmentAllocation[];
  estimatedShippingCostCents: number;
  totalDistanceKm: number;
  splitCount: number;
  score: number; // Combined weighted score (lower is better)
}

export interface IRoutingStrategy {
  score(plan: FulfillmentPlan): number;
}

export class MinimizeSplitsStrategy implements IRoutingStrategy {
  // Strongly penalize splits first, then optimize for cost and distance
  score(plan: FulfillmentPlan): number {
    const splitPenalty = plan.splitCount * 1000000; // 1,000,000 score penalty per split
    const costFactor = plan.estimatedShippingCostCents;
    const distanceFactor = plan.totalDistanceKm * 0.1;
    return splitPenalty + costFactor + distanceFactor;
  }
}

export class MinimizeCostStrategy implements IRoutingStrategy {
  // Moderate penalty for splits, prioritize lowest carrier rates
  score(plan: FulfillmentPlan): number {
    const splitPenalty = plan.splitCount * 500; // 500 cents ($5.00) penalty per split
    const costFactor = plan.estimatedShippingCostCents;
    const distanceFactor = plan.totalDistanceKm * 0.1;
    return splitPenalty + costFactor + distanceFactor;
  }
}

export class MinimizeDistanceStrategy implements IRoutingStrategy {
  // Strongly prioritize shortest distance, ignore cost/splits slightly
  score(plan: FulfillmentPlan): number {
    const splitPenalty = plan.splitCount * 1000;
    const costFactor = plan.estimatedShippingCostCents * 0.1;
    const distanceFactor = plan.totalDistanceKm * 10; // Highly weighted
    return splitPenalty + costFactor + distanceFactor;
  }
}
