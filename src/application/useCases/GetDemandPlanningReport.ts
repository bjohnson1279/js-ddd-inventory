import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { IReorderPolicyRepository } from "../../domain/repositories/IReorderPolicyRepository";
import { IDemandForecastRepository } from "../../domain/repositories/IDemandForecastRepository";
import { CalculateSalesVelocity } from "./CalculateSalesVelocity";

export interface DemandPlanningReportItem {
  sku: string;
  locationId: string;
  currentStock: number;
  averageDailySales7d: number;
  averageDailySales30d: number;
  averageDailySales90d: number;
  daysOfCover: number;
  runOutDate: Date | null;
  
  // Policy details
  reorderPoint: number;
  reorderQuantity: number;
  safetyStock: number;

  // Forecasting details
  forecastedDemand30d: number;
  confidenceLevel: number;

  // Recommendations
  actionRequired: boolean;
  recommendedOrderQuantity: number;
}

export class GetDemandPlanningReport {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly reorderPolicyRepository: IReorderPolicyRepository,
    private readonly demandForecastRepository: IDemandForecastRepository,
    private readonly calculateSalesVelocity: CalculateSalesVelocity
  ) {}

  async execute(locationId: string = "default"): Promise<DemandPlanningReportItem[]> {
    // 1. Fetch all stock items at location
    const inventoryItems = await this.inventoryRepository.findAllByLocation(locationId);

    // 1.5. Fetch all policies for location
    let policyMap: Map<string, any> | undefined = undefined;
    if (this.reorderPolicyRepository.findAllByLocation) {
      const policies = await this.reorderPolicyRepository.findAllByLocation(locationId);
      policyMap = new Map(policies.map(p => [p.sku.getValue(), p]));
    }

    // 2. Fetch all forecasts for location
    const forecasts = await this.demandForecastRepository.findAllForLocation(locationId);

    const now = new Date();
    const endWindow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const activeForecastsMap = new Map();
    for (const f of forecasts) {
      if (f.periodEnd >= now && f.periodStart <= endWindow && !activeForecastsMap.has(f.sku)) {
        activeForecastsMap.set(f.sku, f);
      }
    }

    const reportItemsPromises = inventoryItems.map(async (item) => {
      const skuStr = item.sku.getValue();

      // Calculate Sales Velocity and Fetch Reorder Policy concurrently
      // We pass the current stock to execute to avoid an N+1 query inside CalculateSalesVelocity
      const velocity = await this.calculateSalesVelocity.execute(skuStr, locationId, item.quantity.getValue());
      const policy = policyMap ? policyMap.get(skuStr) : await this.reorderPolicyRepository.findBySkuAndLocation(item.sku, locationId);
      const reorderPoint = policy ? policy.reorderPoint : 10;
      const reorderQuantity = policy ? policy.reorderQuantity : 20;
      const safetyStock = policy ? policy.safetyStock : 5;

      // Find active forecast within the next 30 days
      const activeForecast = activeForecastsMap.get(skuStr);

      const forecastedDemand30d = activeForecast ? activeForecast.forecastedQuantity : Math.ceil(velocity.averageDailySales30d * 30);
      const confidenceLevel = activeForecast ? activeForecast.confidenceLevel : (velocity.averageDailySales30d > 0 ? 0.70 : 0.50);

      // Heuristic: Action Required if current stock is below reorderPoint
      const actionRequired = item.quantity.getValue() <= reorderPoint;
      const recommendedOrderQuantity = actionRequired ? reorderQuantity : 0;

      return {
        sku: skuStr,
        locationId,
        currentStock: item.quantity.getValue(),
        averageDailySales7d: velocity.averageDailySales7d,
        averageDailySales30d: velocity.averageDailySales30d,
        averageDailySales90d: velocity.averageDailySales90d,
        daysOfCover: velocity.daysOfCover,
        runOutDate: velocity.runOutDate,
        
        reorderPoint,
        reorderQuantity,
        safetyStock,

        forecastedDemand30d,
        confidenceLevel,

        actionRequired,
        recommendedOrderQuantity
      };
    });

    return Promise.all(reportItemsPromises);
  }
}
