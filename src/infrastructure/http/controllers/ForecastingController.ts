import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { GetDemandPlanningReport } from "../../../application/useCases/GetDemandPlanningReport";
import { GenerateDemandForecast } from "../../../application/useCases/GenerateDemandForecast";
import { CalculateSalesVelocity } from "../../../application/useCases/CalculateSalesVelocity";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { IReorderPolicyRepository } from "../../../domain/repositories/IReorderPolicyRepository";
import { IDemandForecastRepository } from "../../../domain/repositories/IDemandForecastRepository";
import { IDispatchRecordRepository } from "../../../domain/repositories/IDispatchRecordRepository";
import { DomainException } from "../../../domain/exceptions/DomainException";
import { Logger } from "../../../infrastructure/logging/logger";


export class ForecastingController {
  static async getReport(request: FastifyRequest, reply: FastifyReply) {
    try {
      const inventoryRepository = request.server["inventoryRepository"] as IInventoryRepository;
      const reorderPolicyRepository = request.server["reorderPolicyRepository"] as IReorderPolicyRepository;
      const demandForecastRepository = request.server["demandForecastRepository"] as IDemandForecastRepository;
      const dispatchRecordRepository = request.server["dispatchRecordRepository"] as IDispatchRecordRepository;

      const salesVelocityService = new CalculateSalesVelocity(dispatchRecordRepository, inventoryRepository);
      const useCase = new GetDemandPlanningReport(
        inventoryRepository,
        reorderPolicyRepository,
        demandForecastRepository,
        dispatchRecordRepository,
        salesVelocityService
      );

      if (request.query.locationId !== undefined && typeof request.query.locationId !== "string") {
        return reply.status(400).send({ error: "Invalid locationId parameter" });
      }
      const locationId = request.query.locationId ? (request.query.locationId as string).trim() : "default";
      const report = await useCase.execute(locationId);

      reply.status(200).send(report);
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "ForecastingController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "ForecastingController", message: "Failed to fetch demand planning report:", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async generateForecast(request: FastifyRequest, reply: FastifyReply) {
    try {
      const inventoryRepository = request.server["inventoryRepository"] as IInventoryRepository;
      const demandForecastRepository = request.server["demandForecastRepository"] as IDemandForecastRepository;
      const dispatchRecordRepository = request.server["dispatchRecordRepository"] as IDispatchRecordRepository;

      const salesVelocityService = new CalculateSalesVelocity(dispatchRecordRepository, inventoryRepository);
      const useCase = new GenerateDemandForecast(demandForecastRepository, salesVelocityService, dispatchRecordRepository);

      const { sku, locationId, forecastDays, trendMultiplier } = request.body;
      if (!sku) {
        return reply.status(400).send({ error: "Missing required parameter: sku" });
      }

      const forecast = await useCase.execute({
        sku,
        locationId: locationId || "default",
        forecastDays: forecastDays ? parseInt(forecastDays) : 30,
        trendMultiplier: trendMultiplier ? parseFloat(trendMultiplier) : 1.0
      });

      reply.status(200).send({
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
        Logger.error({ context: "ForecastingController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "ForecastingController", message: "Failed to generate demand forecast:", error: error });
        reply.status(500).send({ error: "Failed to generate demand forecast" });
      }
    }
  }

  static async getDispatchSummary(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { prisma } = require("../../database/prisma");
      const sku = request.query.sku as string;
      
      if (sku !== undefined && typeof sku !== "string") {
        return reply.status(400).send({ error: "Invalid sku parameter" });
      }

      let results;
      if (sku) {
        results = await prisma.$queryRaw(Prisma.sql`SELECT bucket::text, sku, "locationId", total_dispatched as "totalDispatched", dispatch_count as "dispatchCount"
           FROM daily_dispatch_summary
           WHERE sku = ${sku}
           ORDER BY bucket DESC`);
      } else {
        results = await prisma.$queryRaw(Prisma.sql`SELECT bucket::text, sku, "locationId", total_dispatched as "totalDispatched", dispatch_count as "dispatchCount"
           FROM daily_dispatch_summary
           ORDER BY bucket DESC`);
      }
      
      reply.status(200).send(results);
    } catch (error: any) {
      Logger.error({ context: "ForecastingController", message: "Failed to fetch dispatch summary from continuous aggregate:", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }
}
