import { IDemandForecastRepository, DemandForecast } from "../../domain/repositories/IDemandForecastRepository";
import { IDispatchRecordRepository } from "../../domain/repositories/IDispatchRecordRepository";
import { CalculateSalesVelocity } from "./CalculateSalesVelocity";

export interface GenerateForecastCommand {
  sku: string;
  locationId: string;
  forecastDays: number;
  trendMultiplier?: number;
}

export class GenerateDemandForecast {
  constructor(
    private readonly demandForecastRepository: IDemandForecastRepository,
    private readonly calculateSalesVelocity: CalculateSalesVelocity,
    private readonly dispatchRecordRepository: IDispatchRecordRepository
  ) {}

  async execute(command: GenerateForecastCommand): Promise<DemandForecast> {
    const { sku, locationId, forecastDays, trendMultiplier = 1.0 } = command;

    const velocity = await this.calculateSalesVelocity.execute(sku, locationId);
    
    // Project future demand based on 30-day average daily sales
    const baseQuantity = velocity.averageDailySales30d * forecastDays;

    // --- Seasonal Multiplier Calculation ---
    // Fetch last 365 days of dispatch history
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const history = await this.dispatchRecordRepository.fetchHistory(sku, locationId, oneYearAgo);

    let seasonalMultiplier = 1.0;
    if (history.length > 0) {
      // Group historical sales by month
      const monthlySales = Array(12).fill(0);
      const monthlyCounts = Array(12).fill(0);
      
      history.forEach(record => {
        const month = record.dispatchedAt.getMonth(); // 0-11
        monthlySales[month] += record.quantity;
        monthlyCounts[month] += 1;
      });

      // Calculate overall average monthly sales
      const totalSales = monthlySales.reduce((sum, s) => sum + s, 0);
      const activeMonths = monthlySales.filter(s => s > 0).length || 1;
      const overallMonthlyAverage = totalSales / activeMonths;

      if (overallMonthlyAverage > 0) {
        // Target month is the forecast period start month
        const targetMonth = new Date().getMonth();
        const targetMonthSales = monthlySales[targetMonth];
        
        // If target month has historical data, compute index, otherwise default to 1.0
        if (targetMonthSales > 0) {
          seasonalMultiplier = targetMonthSales / overallMonthlyAverage;
          // Cap index at reasonable boundaries [0.3, 3.0] to prevent extreme swings
          seasonalMultiplier = Math.max(0.3, Math.min(3.0, seasonalMultiplier));
        }
      }
    }

    const forecastedQuantity = Math.ceil(baseQuantity * trendMultiplier * seasonalMultiplier);

    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + forecastDays * 24 * 60 * 60 * 1000);

    // Confidence index increases if historical sales patterns match current velocity
    const confidenceLevel = velocity.averageDailySales30d > 0 ? (seasonalMultiplier !== 1.0 ? 0.90 : 0.85) : 0.50;

    const forecast = new DemandForecast(
      "",
      sku,
      locationId,
      forecastedQuantity,
      periodStart,
      periodEnd,
      confidenceLevel,
      new Date()
    );

    await this.demandForecastRepository.save(forecast);

    return forecast;
  }
}
