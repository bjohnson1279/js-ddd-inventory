import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { IReorderPolicyRepository } from "../../../domain/repositories/IReorderPolicyRepository";
import { ReorderPolicy } from "../../../domain/procurement/aggregates/ReorderPolicy";
import { SKU } from "../../../domain/valueObjects/SKU";
import { DomainException } from "../../../domain/exceptions/DomainException";
import { ReorderPolicyService } from "../../../domain/procurement/services/ReorderPolicyService";
import { DemandVelocityCalculator, ReorderPointForecaster } from "../../../domain/procurement/services/ReplenishmentForecaster";
import { IProductRepository } from "../../../domain/repositories/IProductRepository";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { IDispatchRecordRepository } from "../../../domain/repositories/IDispatchRecordRepository";
import { Logger } from "../../../infrastructure/logging/logger";

export class ReorderPolicyController {
  static async createOrUpdate(request: any, reply: any) {
    try {
      const repo = (request.server as any)["reorderPolicyRepository"] as IReorderPolicyRepository;
      const { sku, locationId, reorderPoint, reorderQuantity, safetyStock, dynamicRopEnabled } = (request.body as any);

      const id = crypto.randomUUID();
      const policy = new ReorderPolicy(
        id,
        SKU.create(sku),
        locationId,
        reorderPoint,
        reorderQuantity,
        safetyStock,
        !!dynamicRopEnabled
      );

      await repo.save(policy);
      reply.status(200).send({
        id: policy.id,
        sku: policy.sku.getValue(),
        locationId: policy.locationId,
        reorderPoint: policy.reorderPoint,
        reorderQuantity: policy.reorderQuantity,
        safetyStock: policy.safetyStock,
        dynamicRopEnabled: policy.dynamicRopEnabled
      });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "ReorderPolicyController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "ReorderPolicyController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async get(request: any, reply: any) {
    try {
      const repo = (request.server as any)["reorderPolicyRepository"] as IReorderPolicyRepository;
      const { sku, locationId } = (request.params as any);

      const policy = await repo.findBySkuAndLocation(SKU.create(sku), locationId);
      if (!policy) {
        return reply.status(404).send({ error: "Reorder policy not found" });
      }

      reply.status(200).send({
        id: policy.id,
        sku: policy.sku.getValue(),
        locationId: policy.locationId,
        reorderPoint: policy.reorderPoint,
        reorderQuantity: policy.reorderQuantity,
        safetyStock: policy.safetyStock,
        dynamicRopEnabled: policy.dynamicRopEnabled
      });
    } catch (error: any) {
      Logger.error({ context: "ReorderPolicyController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async evaluate(request: any, reply: any) {
    try {
      const service = (request.server as any)["reorderPolicyService"] as ReorderPolicyService;
      const productRepository = (request.server as any)["productRepository"] as IProductRepository;
      const poRepository = (request.server as any)["purchaseOrderRepository"] as any;
      const inventoryRepository = (request.server as any)["inventoryRepository"] as IInventoryRepository;
      const dispatchRecordRepository = (request.server as any)["dispatchRecordRepository"] as IDispatchRecordRepository;

      const velocityCalculator = new DemandVelocityCalculator(dispatchRecordRepository, productRepository);
      const forecaster = new ReorderPointForecaster(velocityCalculator, productRepository, poRepository);
      const tenantId = (request as any).tenantId || "tenant-1";

      const locationId = (request.query as any).locationId as string | undefined;
      const results = await service.evaluatePolicies(tenantId, forecaster, inventoryRepository, 30, locationId);

      reply.status(200).send({ results });
    } catch (error: any) {
      Logger.error({ context: "ReorderPolicyController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }
}
