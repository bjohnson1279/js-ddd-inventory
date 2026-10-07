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
  static async createOrUpdate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const repo = request.server["reorderPolicyRepository"] as IReorderPolicyRepository;
      const { sku, locationId, reorderPoint, reorderQuantity, safetyStock, dynamicRopEnabled } = request.body;

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

  static async get(request: FastifyRequest, reply: FastifyReply) {
    try {
      const repo = request.server["reorderPolicyRepository"] as IReorderPolicyRepository;
      const { sku, locationId } = request.params;

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

  static async evaluate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const service = request.server["reorderPolicyService"] as ReorderPolicyService;
      const productRepository = request.server["productRepository"] as IProductRepository;
      const poRepository = request.server["purchaseOrderRepository"] as any;
      const inventoryRepository = request.server["inventoryRepository"] as IInventoryRepository;
      const dispatchRecordRepository = request.server["dispatchRecordRepository"] as IDispatchRecordRepository;

      const velocityCalculator = new DemandVelocityCalculator(dispatchRecordRepository, productRepository);
      const forecaster = new ReorderPointForecaster(velocityCalculator, productRepository, poRepository);
      const tenantId = (req as any).tenantId || "tenant-1";

      const locationId = request.query.locationId as string | undefined;
      const results = await service.evaluatePolicies(tenantId, forecaster, inventoryRepository, 30, locationId);

      reply.status(200).send({ results });
    } catch (error: any) {
      Logger.error({ context: "ReorderPolicyController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }
}
