import { Request, Response } from "express";
import { CreateInventoryAudit } from "../../../application/useCases/CreateInventoryAudit";
import { StartInventoryAudit } from "../../../application/useCases/StartInventoryAudit";
import { RecordAuditCount } from "../../../application/useCases/RecordAuditCount";
import { CompleteInventoryAudit } from "../../../application/useCases/CompleteInventoryAudit";
import { ReconcileInventoryAudit } from "../../../application/useCases/ReconcileInventoryAudit";
import { IInventoryAuditRepository } from "../../../domain/repositories/IInventoryAuditRepository";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../../domain/repositories/ICostLayerRepository";
import { ITenantConfigRepository } from "../../../domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../../domain/repositories/IJournalRepository";

export class InventoryAuditController {
  static async create(req: Request, res: Response) {
    try {
      const auditRepository = req.app.get("inventoryAuditRepository") as IInventoryAuditRepository;
      const inventoryRepository = req.app.get("inventoryRepository") as IInventoryRepository;
      const useCase = new CreateInventoryAudit(auditRepository, inventoryRepository);

      const audit = await useCase.execute(req.body);
      res.status(201).json({
        id: audit.id,
        auditNumber: audit.auditNumber,
        tenantId: audit.tenantId,
        locationId: audit.locationId,
        status: audit.status,
        createdAt: audit.createdAt,
        updatedAt: audit.updatedAt,
        items: audit.items.map(i => ({
          id: i.id,
          variantId: i.variantId,
          expectedQuantity: i.expectedQuantity,
          countedQuantity: i.countedQuantity,
          discrepancy: i.discrepancy,
          isCounted: i.isCounted
        }))
      });
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  static async start(req: Request, res: Response) {
    try {
      const auditRepository = req.app.get("inventoryAuditRepository") as IInventoryAuditRepository;
      const useCase = new StartInventoryAudit(auditRepository);
      await useCase.execute(req.params.id);
      res.status(200).json({ message: "Inventory audit started successfully" });
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  static async recordCount(req: Request, res: Response) {
    try {
      const auditRepository = req.app.get("inventoryAuditRepository") as IInventoryAuditRepository;
      const useCase = new RecordAuditCount(auditRepository);
      await useCase.execute({
        auditId: req.params.id,
        variantId: req.body.variantId,
        countedQuantity: req.body.countedQuantity
      });
      res.status(200).json({ message: "Count recorded successfully" });
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  static async complete(req: Request, res: Response) {
    try {
      const auditRepository = req.app.get("inventoryAuditRepository") as IInventoryAuditRepository;
      const useCase = new CompleteInventoryAudit(auditRepository);
      await useCase.execute(req.params.id);
      res.status(200).json({ message: "Inventory audit completed successfully" });
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  static async reconcile(req: Request, res: Response) {
    try {
      const auditRepository = req.app.get("inventoryAuditRepository") as IInventoryAuditRepository;
      const inventoryRepository = req.app.get("inventoryRepository") as IInventoryRepository;
      const costLayerRepository = req.app.get("costLayerRepository") as ICostLayerRepository;
      const tenantConfigRepository = req.app.get("tenantConfigRepository") as ITenantConfigRepository;
      const journalRepository = req.app.get("journalRepository") as IJournalRepository;

      const useCase = new ReconcileInventoryAudit(
        auditRepository,
        inventoryRepository,
        costLayerRepository,
        tenantConfigRepository,
        journalRepository
      );

      await useCase.execute(req.params.id);
      res.status(200).json({ message: "Inventory audit reconciled successfully" });
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }

  static async get(req: Request, res: Response) {
    try {
      const auditRepository = req.app.get("inventoryAuditRepository") as IInventoryAuditRepository;
      const audit = await auditRepository.findById(req.params.id);
      if (!audit) {
        return res.status(404).json({ error: "Inventory audit not found" });
      }
      res.status(200).json({
        id: audit.id,
        auditNumber: audit.auditNumber,
        tenantId: audit.tenantId,
        locationId: audit.locationId,
        status: audit.status,
        createdAt: audit.createdAt,
        updatedAt: audit.updatedAt,
        items: audit.items.map(i => ({
          id: i.id,
          variantId: i.variantId,
          expectedQuantity: i.expectedQuantity,
          countedQuantity: i.countedQuantity,
          discrepancy: i.discrepancy,
          isCounted: i.isCounted
        }))
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
