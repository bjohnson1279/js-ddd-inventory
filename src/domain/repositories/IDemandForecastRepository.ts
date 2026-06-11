export class DemandForecast {
  constructor(
    public readonly id: string,
    public readonly sku: string,
    public readonly locationId: string,
    public readonly forecastedQuantity: number,
    public readonly periodStart: Date,
    public readonly periodEnd: Date,
    public readonly confidenceLevel: number,
    public readonly createdAt: Date
  ) {}
}

export interface IDemandForecastRepository {
  save(forecast: DemandForecast): Promise<void>;
  findForecast(sku: string, locationId: string, periodStart: Date, periodEnd: Date): Promise<DemandForecast | null>;
  findAllForLocation(locationId: string): Promise<DemandForecast[]>;
}
