import { Request, Response } from "express";
import { IReorderPolicyRepository } from "../../../domain/repositories/IReorderPolicyRepository";
import { ReorderPolicy } from "../../../domain/procurement/aggregates/ReorderPolicy";
import { SKU } from "../../../domain/valueObjects/SKU";
import { DomainException } from "../../../domain/exceptions/DomainException";
import { ReorderPolicyService } from "../../../domain/procurement/services/ReorderPolicyService";
import { DemandVelocityCalculator, ReorderPointForecaster } from "../../../domain/procurement/services/ReplenishmentForecaster";
import { IProductRepository } from "../../../domain/repositories/IProductRepository";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { IDispatchRecordRepository } from "../../../domain/repositories/IDispatchRecordRepository";

export class ReorderPolicyController {
  static async createOrUpdate(req: Request, res: Response) {
    try {
      const repo = req.app.get("reorderPolicyRepository") as IReorderPolicyRepository;
      const { sku, locationId, reorderPoint, reorderQuantity, safetyStock, dynamicRopEnabled } = req.body;

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
      res.status(200).json({
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
        console.error(error);
        res.status(400).json({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async get(req: Request, res: Response) {
    try {
      const repo = req.app.get("reorderPolicyRepository") as IReorderPolicyRepository;
      const { sku, locationId } = req.params;

      const policy = await repo.findBySkuAndLocation(SKU.create(sku), locationId);
      if (!policy) {
        return res.status(404).json({ error: "Reorder policy not found" });
      }

      res.status(200).json({
        id: policy.id,
        sku: policy.sku.getValue(),
        locationId: policy.locationId,
        reorderPoint: policy.reorderPoint,
        reorderQuantity: policy.reorderQuantity,
        safetyStock: policy.safetyStock,
        dynamicRopEnabled: policy.dynamicRopEnabled
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async evaluate(req: Request, res: Response) {
    try {
      const service = req.app.get("reorderPolicyService") as ReorderPolicyService;
      const productRepository = req.app.get("productRepository") as IProductRepository;
      const poRepository = req.app.get("purchaseOrderRepository") as any;
      const inventoryRepository = req.app.get("inventoryRepository") as IInventoryRepository;
      const dispatchRecordRepository = req.app.get("dispatchRecordRepository") as IDispatchRecordRepository;

      const velocityCalculator = new DemandVelocityCalculator(dispatchRecordRepository, productRepository);
      const forecaster = new ReorderPointForecaster(velocityCalculator, productRepository, poRepository);
      const tenantId = (req as any).tenantId || "tenant-1";

      const results = await service.evaluatePolicies(tenantId, forecaster, inventoryRepository);

      res.status(200).json({ results });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
