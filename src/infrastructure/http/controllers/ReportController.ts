import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../../database/prisma";
import crypto from "crypto";

export class ReportController {
  static async createReport(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || "tenant-1";
      const { name, description, type, filters, grouping } = req.body;
      const actorId = req.user?.id || "system";

      const report = await prisma.reportDefinitionModel.create({
        data: {
          tenantId,
          name,
          description,
          type,
          filters: JSON.stringify(filters || {}),
          grouping: JSON.stringify(grouping || {}),
          createdBy: actorId
        }
      });

      return res.status(201).json({ success: true, report });
    } catch (error: any) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async listReports(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId || "tenant-1";
      const reports = await prisma.reportDefinitionModel.findMany({
        where: { tenantId }
      });
      return res.status(200).json({ reports });
    } catch (error: any) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async scheduleReport(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { cronExpression, deliveryMethod } = req.body;

      // In real code, parse cron string to calculate nextRunAt. We use a mock date for scaffolding.
      const nextRunAt = new Date(Date.now() + 60 * 60 * 1000); 

      const schedule = await prisma.reportScheduleModel.create({
        data: {
          reportDefinitionId: id,
          cronExpression,
          nextRunAt,
          deliveryMethod: deliveryMethod || "INTERNAL"
        }
      });

      return res.status(201).json({ success: true, schedule });
    } catch (error: any) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async executeReport(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { format } = req.body; // csv, pdf, xlsx
      
      const execution = await prisma.reportExecutionModel.create({
        data: {
          reportDefinitionId: id,
          format: format || "csv",
          status: "PENDING"
        }
      });

      // Dispatch to outbox to be picked up by ReportGenerationWorker
      await prisma.outboxEventModel.create({
        data: {
          eventName: "ReportExecutionRequested",
          payload: JSON.stringify({ executionId: execution.id }),
          occurredOn: new Date()
        }
      });

      return res.status(202).json({ success: true, message: "Report execution queued", executionId: execution.id });
    } catch (error: any) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async getSharedLink(req: AuthenticatedRequest, res: Response) {
    try {
      const { token } = req.params;
      const link = await prisma.sharedReportLinkModel.findUnique({
        where: { token },
        include: { reportExecution: true }
      });

      if (!link) {
        return res.status(404).json({ error: "Link not found" });
      }
      if (link.expiresAt < new Date()) {
        return res.status(403).json({ error: "Link expired" });
      }

      return res.status(200).json({ 
        success: true, 
        fileUrl: link.reportExecution.fileUrl 
      });
    } catch (error: any) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
