import { Request, Response } from "express";
import { GetDemandPlanningReport } from "../../../application/useCases/GetDemandPlanningReport";
import { GenerateDemandForecast } from "../../../application/useCases/GenerateDemandForecast";
import { CalculateSalesVelocity } from "../../../application/useCases/CalculateSalesVelocity";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { IReorderPolicyRepository } from "../../../domain/repositories/IReorderPolicyRepository";
import { IDemandForecastRepository } from "../../../domain/repositories/IDemandForecastRepository";
import { IDispatchRecordRepository } from "../../../domain/repositories/IDispatchRecordRepository";
import { DomainException } from "../../../domain/exceptions/DomainException";


export class ForecastingController {
  static async getReport(req: Request, res: Response) {
    try {
      const inventoryRepository = req.app.get("inventoryRepository") as IInventoryRepository;
      const reorderPolicyRepository = req.app.get("reorderPolicyRepository") as IReorderPolicyRepository;
      const demandForecastRepository = req.app.get("demandForecastRepository") as IDemandForecastRepository;
      const dispatchRecordRepository = req.app.get("dispatchRecordRepository") as IDispatchRecordRepository;

      const salesVelocityService = new CalculateSalesVelocity(dispatchRecordRepository, inventoryRepository);
      const useCase = new GetDemandPlanningReport(
        inventoryRepository,
        reorderPolicyRepository,
        demandForecastRepository,
        salesVelocityService
      );

      if (req.query.locationId !== undefined && typeof req.query.locationId !== "string") {
        return res.status(400).json({ error: "Invalid locationId parameter" });
      }
      const locationId = req.query.locationId ? (req.query.locationId as string).trim() : "default";
      const report = await useCase.execute(locationId);

      res.status(200).json(report);
    } catch (error: any) {
      if (error instanceof DomainException) {
        console.error(error.message);
        res.status(400).json({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        console.error("Failed to fetch demand planning report:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async generateForecast(req: Request, res: Response) {
    try {
      const inventoryRepository = req.app.get("inventoryRepository") as IInventoryRepository;
      const demandForecastRepository = req.app.get("demandForecastRepository") as IDemandForecastRepository;
      const dispatchRecordRepository = req.app.get("dispatchRecordRepository") as IDispatchRecordRepository;

      const salesVelocityService = new CalculateSalesVelocity(dispatchRecordRepository, inventoryRepository);
      const useCase = new GenerateDemandForecast(demandForecastRepository, salesVelocityService);

      const { sku, locationId, forecastDays, trendMultiplier } = req.body;
      if (!sku) {
        return res.status(400).json({ error: "Missing required parameter: sku" });
      }

      const forecast = await useCase.execute({
        sku,
        locationId: locationId || "default",
        forecastDays: forecastDays ? parseInt(forecastDays) : 30,
        trendMultiplier: trendMultiplier ? parseFloat(trendMultiplier) : 1.0
      });

      res.status(200).json({
        message: "Demand forecast generated successfully",
        forecast: {
          id: forecast.id,
          sku: forecast.sku,
          locationId: forecast.locationId,
          forecastedQuantity: forecast.forecastedQuantity,
          periodStart: forecast.periodStart,
          periodEnd: forecast.periodEnd,
          confidenceLevel: forecast.confidenceLevel,
          createdAt: forecast.createdAt
        }
      });
    } catch (error: any) {
      if (error instanceof DomainException) {
        console.error(error.message);
        res.status(400).json({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        console.error("Failed to generate demand forecast:", error);
        res.status(500).json({ error: "Failed to generate demand forecast" });
      }
    }
  }

  static async getDispatchSummary(req: Request, res: Response) {
    try {
      const { prisma } = require("../../database/prisma");
      const sku = req.query.sku as string;
      
      const query = sku 
        ? `SELECT bucket::text, sku, "locationId", total_dispatched as "totalDispatched", dispatch_count as "dispatchCount"
           FROM daily_dispatch_summary
           WHERE sku = $1
           ORDER BY bucket DESC`
        : `SELECT bucket::text, sku, "locationId", total_dispatched as "totalDispatched", dispatch_count as "dispatchCount"
           FROM daily_dispatch_summary
           ORDER BY bucket DESC`;
      
      const params = sku ? [sku] : [];
      const results = await prisma.$queryRawUnsafe(query, ...params);
      
      res.status(200).json(results);
    } catch (error: any) {
      console.error("Failed to fetch dispatch summary from continuous aggregate:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
