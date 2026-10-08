import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { prisma } from "../../database/prisma";
import { ComplianceLedgerService } from "../../../domain/services/ComplianceLedgerService";
import { Logger } from "../../../infrastructure/logging/logger";

export class ComplianceController {
  public static async list(request: any, reply: any) {
    try {
      const tenantId = typeof (request.query as any).tenantId === "string" ? (request.query as any).tenantId : undefined;
      let ledger: any[] = [];
      try {
        ledger = await prisma.complianceLedgerModel.findMany({
          where: tenantId ? { tenantId } : undefined,
          orderBy: { sequenceNumber: "desc" }
        });
      } catch (e) {
        ledger = ComplianceLedgerService.getInMemoryLedger(tenantId);
      }

      reply.status(200).send(ledger);
    } catch (error: any) {
      Logger.error({ context: "ComplianceController", message: "Error listing ledger:", error: error });
      reply.status(500).send({ error: "Failed to load compliance ledger." });
    }
  }

  public static async verify(request: any, reply: any) {
    try {
      const tenantId = typeof (request.query as any).tenantId === "string" ? (request.query as any).tenantId : undefined;
      const result = await ComplianceLedgerService.validateLedger(tenantId);
      
      reply.status(200).send(result);
    } catch (error: any) {
      Logger.error({ context: "ComplianceController", message: "Error verifying ledger:", error: error });
      reply.status(500).send({ error: "Failed to run cryptographic validation on compliance ledger." });
    }
  }

  public static async reconstruct(request: any, reply: any) {
    try {
      const tenantId = typeof (request.query as any).tenantId === "string" ? (request.query as any).tenantId : "tenant-1";
      const timestamp = typeof (request.query as any).timestamp === "string" ? (request.query as any).timestamp : undefined;
      const result = await ComplianceLedgerService.reconstructState(tenantId, timestamp);
      reply.status(200).send(result);
    } catch (error: any) {
      Logger.error({ context: "ComplianceController", message: "Error reconstructing state:", error: error });
      reply.status(500).send({ error: "Failed to reconstruct state." });
    }
  }

  public static async replay(request: any, reply: any) {
    try {
      const tenantId = typeof (request.query as any).tenantId === "string" ? (request.query as any).tenantId : "tenant-1";
      const timestamp = typeof (request.query as any).timestamp === "string" ? (request.query as any).timestamp : undefined;
      const result = await ComplianceLedgerService.replayAudit(tenantId, timestamp);
      reply.status(200).send(result);
    } catch (error: any) {
      Logger.error({ context: "ComplianceController", message: "Error replaying audit log:", error: error });
      reply.status(500).send({ error: "Failed to replay audit log." });
    }
  }
}

