import { IDemandForecastRepository, DemandForecast } from "../../domain/repositories/IDemandForecastRepository";
import { prisma } from "./prisma";

export class PrismaDemandForecastRepository implements IDemandForecastRepository {
  private prisma = prisma;

  async save(forecast: DemandForecast): Promise<void> {
    await this.prisma.demandForecastModel.upsert({
      where: {
        sku_locationId_periodStart_periodEnd: {
          sku: forecast.sku,
          locationId: forecast.locationId,
          periodStart: forecast.periodStart,
          periodEnd: forecast.periodEnd
        }
      },
      update: {
        forecastedQuantity: forecast.forecastedQuantity,
        confidenceLevel: forecast.confidenceLevel
      },
      create: {
        sku: forecast.sku,
        locationId: forecast.locationId,
        forecastedQuantity: forecast.forecastedQuantity,
        periodStart: forecast.periodStart,
        periodEnd: forecast.periodEnd,
        confidenceLevel: forecast.confidenceLevel
      }
    });
  }

  async findForecast(sku: string, locationId: string, periodStart: Date, periodEnd: Date): Promise<DemandForecast | null> {
    const f = await this.prisma.demandForecastModel.findUnique({
      where: {
        sku_locationId_periodStart_periodEnd: {
          sku,
          locationId,
          periodStart,
          periodEnd
        }
      }
    });

    if (!f) return null;
    return new DemandForecast(
      f.id,
      f.sku,
      f.locationId,
      f.forecastedQuantity,
      f.periodStart,
      f.periodEnd,
      f.confidenceLevel,
      f.createdAt
    );
  }

  async findAllForLocation(locationId: string): Promise<DemandForecast[]> {
    const forecasts = await this.prisma.demandForecastModel.findMany({
      where: { locationId },
      orderBy: { periodStart: "asc" }
    });

    return forecasts.map(
      (f) => new DemandForecast(
        f.id,
        f.sku,
        f.locationId,
        f.forecastedQuantity,
        f.periodStart,
        f.periodEnd,
        f.confidenceLevel,
        f.createdAt
      )
    );
  }
}
