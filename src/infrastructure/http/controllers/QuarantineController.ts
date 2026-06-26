import { DomainException } from "../../../domain/exceptions/DomainException";

import { Request, Response } from "express";
import { ResolveQuarantineItem } from "../../../application/useCases/ResolveQuarantineItem";
import { IQuarantineRepository } from "../../../domain/repositories/IQuarantineRepository";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../../domain/repositories/ICostLayerRepository";
import { ITenantConfigRepository } from "../../../domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../../domain/repositories/IJournalRepository";

export class QuarantineController {
  static async resolve(req: Request, res: Response) {
    try {
      const quarantineRepository = req.app.get("quarantineRepository") as IQuarantineRepository;
      const inventoryRepository = req.app.get("inventoryRepository") as IInventoryRepository;
      const costLayerRepository = req.app.get("costLayerRepository") as ICostLayerRepository;
      const tenantConfigRepository = req.app.get("tenantConfigRepository") as ITenantConfigRepository;
      const journalRepository = req.app.get("journalRepository") as IJournalRepository;

      const useCase = new ResolveQuarantineItem(
        quarantineRepository,
        inventoryRepository,
        costLayerRepository,
        tenantConfigRepository,
        journalRepository
      );

      await useCase.execute({
        quarantineItemId: req.params.id,
        resolution: req.body.resolution,
      });

      res.status(200).json({ message: "Quarantine item resolved successfully" });
    } catch (error: any) {
      console.error(error);
      console.error(error instanceof DomainException ? error.message : error);
      res.status(400).json({ error: "Bad request" });
    }
  }

  static async get(req: Request, res: Response) {
    try {
      const quarantineRepository = req.app.get("quarantineRepository") as IQuarantineRepository;
      const item = await quarantineRepository.findById(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Quarantine item not found" });
      }

      res.status(200).json({
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        reason: item.reason,
        locationId: item.locationId,
        tenantId: item.tenantId,
        status: item.status,
        createdAt: item.createdAt,
        resolvedAt: item.resolvedAt,
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const quarantineRepository = req.app.get("quarantineRepository") as IQuarantineRepository;
      const items = await quarantineRepository.findAll();

      res.status(200).json(
        items.map((item) => ({
          id: item.id,
          variantId: item.variantId,
          quantity: item.quantity,
          reason: item.reason,
          locationId: item.locationId,
          tenantId: item.tenantId,
          status: item.status,
          createdAt: item.createdAt,
          resolvedAt: item.resolvedAt,
        }))
      );
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
