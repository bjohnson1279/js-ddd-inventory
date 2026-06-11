import { IDemandForecastRepository, DemandForecast } from "../../domain/repositories/IDemandForecastRepository";

export class InMemoryDemandForecastRepository implements IDemandForecastRepository {
  public forecasts: DemandForecast[] = [];

  async save(forecast: DemandForecast): Promise<void> {
    const existingIdx = this.forecasts.findIndex(
      (f) =>
        f.sku === forecast.sku &&
        f.locationId === forecast.locationId &&
        f.periodStart.getTime() === forecast.periodStart.getTime() &&
        f.periodEnd.getTime() === forecast.periodEnd.getTime()
    );

    const updated = new DemandForecast(
      crypto.randomUUID(),
      forecast.sku,
      forecast.locationId,
      forecast.forecastedQuantity,
      forecast.periodStart,
      forecast.periodEnd,
      forecast.confidenceLevel,
      forecast.createdAt
    );

    if (existingIdx !== -1) {
      this.forecasts[existingIdx] = updated;
    } else {
      this.forecasts.push(updated);
    }
  }

  async findForecast(sku: string, locationId: string, periodStart: Date, periodEnd: Date): Promise<DemandForecast | null> {
    const f = this.forecasts.find(
      (f) =>
        f.sku === sku &&
        f.locationId === locationId &&
        f.periodStart.getTime() === periodStart.getTime() &&
        f.periodEnd.getTime() === periodEnd.getTime()
    );
    return f || null;
  }

  async findAllForLocation(locationId: string): Promise<DemandForecast[]> {
    return this.forecasts.filter((f) => f.locationId === locationId);
  }
}
