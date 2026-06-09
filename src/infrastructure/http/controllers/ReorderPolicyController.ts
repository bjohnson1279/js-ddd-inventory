import { Request, Response } from "express";
import { IReorderPolicyRepository } from "../../../domain/repositories/IReorderPolicyRepository";
import { ReorderPolicy } from "../../../domain/procurement/aggregates/ReorderPolicy";
import { SKU } from "../../../domain/valueObjects/SKU";
import { DomainException } from "../../../domain/exceptions/DomainException";

export class ReorderPolicyController {
  static async createOrUpdate(req: Request, res: Response) {
    try {
      const repo = req.app.get("reorderPolicyRepository") as IReorderPolicyRepository;
      const { sku, locationId, reorderPoint, reorderQuantity, safetyStock } = req.body;

      const id = Math.random().toString(36).substring(2, 11);
      const policy = new ReorderPolicy(
        id,
        SKU.create(sku),
        locationId,
        reorderPoint,
        reorderQuantity,
        safetyStock
      );

      await repo.save(policy);
      res.status(200).json({
        id: policy.id,
        sku: policy.sku.getValue(),
        locationId: policy.locationId,
        reorderPoint: policy.reorderPoint,
        reorderQuantity: policy.reorderQuantity,
        safetyStock: policy.safetyStock
      });
    } catch (error: any) {
      if (error instanceof DomainException) {
        res.status(400).json({ error: error.message, type: error.name });
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
        safetyStock: policy.safetyStock
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
