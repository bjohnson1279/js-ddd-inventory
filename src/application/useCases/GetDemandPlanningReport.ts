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

    // 2. Fetch all forecasts for location
    const forecasts = await this.demandForecastRepository.findAllForLocation(locationId);

    const reportItemsPromises = inventoryItems.map(async (item) => {
      const skuStr = item.sku.getValue();

      // Calculate Sales Velocity
      const velocity = await this.calculateSalesVelocity.execute(skuStr, locationId);

      // Fetch Reorder Policy
      const policy = await this.reorderPolicyRepository.findBySkuAndLocation(item.sku, locationId);
      const reorderPoint = policy ? policy.reorderPoint : 10;
      const reorderQuantity = policy ? policy.reorderQuantity : 20;
      const safetyStock = policy ? policy.safetyStock : 5;

      // Find active forecast within the next 30 days
      const now = new Date();
      const endWindow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const activeForecast = forecasts.find(
        (f) =>
          f.sku === skuStr &&
          f.periodEnd >= now &&
          f.periodStart <= endWindow
      );

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
