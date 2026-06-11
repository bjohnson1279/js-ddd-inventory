import { IDemandForecastRepository, DemandForecast } from "../../domain/repositories/IDemandForecastRepository";
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
    private readonly calculateSalesVelocity: CalculateSalesVelocity
  ) {}

  async execute(command: GenerateForecastCommand): Promise<DemandForecast> {
    const { sku, locationId, forecastDays, trendMultiplier = 1.0 } = command;

    const velocity = await this.calculateSalesVelocity.execute(sku, locationId);
    
    // Project future demand based on 30-day average daily sales
    const baseQuantity = velocity.averageDailySales30d * forecastDays;
    const forecastedQuantity = Math.ceil(baseQuantity * trendMultiplier);

    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + forecastDays * 24 * 60 * 60 * 1000);

    // Simple heuristic: higher confidence if there is sales velocity history
    const confidenceLevel = velocity.averageDailySales30d > 0 ? 0.85 : 0.50;

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
