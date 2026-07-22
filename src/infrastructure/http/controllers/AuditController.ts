import { Request, Response } from "express";
import { AuditProcessorService } from "../../../domain/services/AuditProcessorService";
import { PrismaAuditDiscrepancyRepository } from "../../database/PrismaAuditDiscrepancyRepository";
import { Logger } from "../../../infrastructure/logging/logger";

export class AuditController {
  static async runAudit(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID is required." });
      }

      const service = new AuditProcessorService();
      const summary = await service.runAudit(tenantId);

      return res.status(200).json(summary);
    } catch (error: any) {
      Logger.error({ context: "AuditController", message: "An error occurred", error: error });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async listDiscrepancies(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const { status } = req.query;

      if (status !== undefined && typeof status !== "string") {
        return res.status(400).json({ error: "Invalid status parameter" });
      }

      const repo = new PrismaAuditDiscrepancyRepository();
      const discrepancies = await repo.findAll(tenantId, status as string || undefined);

      return res.status(200).json({ discrepancies });
    } catch (error: any) {
      Logger.error({ context: "AuditController", message: "An error occurred", error: error });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async resolveDiscrepancy(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const { id } = req.params;
      const { notes } = req.body;

      if (!notes) {
        return res.status(400).json({ error: "Notes are required for resolution." });
      }

      const service = new AuditProcessorService();
      const success = await service.resolveDiscrepancy(tenantId, id, notes);

      if (!success) {
        return res.status(404).json({ error: "Discrepancy not found or already resolved." });
      }

      return res.status(200).json({ success: true });
    } catch (error: any) {
      Logger.error({ context: "AuditController", message: "An error occurred", error: error });
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
