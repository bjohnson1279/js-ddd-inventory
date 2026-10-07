import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../../database/prisma";

export class ReportController {
  static async createReport(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.tenantId || request.user?.tenantId || "tenant-1";
      const { name, description, type, filters, grouping } = request.body;
      const actorId = request.user?.id || "system";

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

      return reply.status(201).send({ success: true, report });
    } catch (error: any) {
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async listReports(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.tenantId || "tenant-1";
      const reports = await prisma.reportDefinitionModel.findMany({
        where: { tenantId }
      });
      return reply.status(200).send({ reports });
    } catch (error: any) {
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async scheduleReport(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = request.params;
      const { cronExpression, deliveryMethod } = request.body;

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

      return reply.status(201).send({ success: true, schedule });
    } catch (error: any) {
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async executeReport(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = request.params;
      const { format } = request.body; // csv, pdf, xlsx
      
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

      return reply.status(202).send({ success: true, message: "Report execution queued", executionId: execution.id });
    } catch (error: any) {
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async getSharedLink(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { token } = request.params;
      const link = await prisma.sharedReportLinkModel.findUnique({
        where: { token },
        include: { reportExecution: true }
      });

      if (!link) {
        return reply.status(404).send({ error: "Link not found" });
      }
      if (link.expiresAt < new Date()) {
        return reply.status(403).send({ error: "Link expired" });
      }

      return reply.status(200).send({ 
        success: true, 
        fileUrl: link.reportExecution.fileUrl 
      });
    } catch (error: any) {
      return reply.status(500).send({ error: "Internal server error" });
    }
  }
}
