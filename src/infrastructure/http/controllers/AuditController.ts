import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { AuditProcessorService } from "../../../domain/services/AuditProcessorService";
import { PrismaAuditDiscrepancyRepository } from "../../database/PrismaAuditDiscrepancyRepository";
import { Logger } from "../../../infrastructure/logging/logger";

export class AuditController {
  static async runAudit(request: any, reply: any) {
    try {
      const tenantId = (request as any).tenantId;
      if (!tenantId) {
        return reply.status(400).send({ error: "Tenant ID is required." });
      }

      const service = new AuditProcessorService();
      const summary = await service.runAudit(tenantId);

      return reply.status(200).send(summary);
    } catch (error: any) {
      Logger.error({ context: "AuditController", message: "An error occurred", error: error });
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async listDiscrepancies(request: any, reply: any) {
    try {
      const tenantId = (request as any).tenantId;
      const { status } = (request.query as any);

      if (status !== undefined && typeof status !== "string") {
        return reply.status(400).send({ error: "Invalid status parameter" });
      }

      const repo = new PrismaAuditDiscrepancyRepository();
      const discrepancies = await repo.findAll(tenantId, status as string || undefined);

      return reply.status(200).send({ discrepancies });
    } catch (error: any) {
      Logger.error({ context: "AuditController", message: "An error occurred", error: error });
      return reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async resolveDiscrepancy(request: any, reply: any) {
    try {
      const tenantId = (request as any).tenantId;
      const { id } = (request.params as any);
      const { notes } = (request.body as any);

      if (!notes) {
        return reply.status(400).send({ error: "Notes are required for resolution." });
      }

      const service = new AuditProcessorService();
      const success = await service.resolveDiscrepancy(tenantId, id, notes);

      if (!success) {
        return reply.status(404).send({ error: "Discrepancy not found or already resolved." });
      }

      return reply.status(200).send({ success: true });
    } catch (error: any) {
      Logger.error({ context: "AuditController", message: "An error occurred", error: error });
      return reply.status(500).send({ error: "Internal server error" });
    }
  }
}
