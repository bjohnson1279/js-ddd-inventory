import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { prisma } from "../../database/prisma";
import { ComplianceLedgerService } from "../../../domain/services/ComplianceLedgerService";
import { Logger } from "../../../infrastructure/logging/logger";

export class ComplianceController {
  public static async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = typeof request.query.tenantId === "string" ? request.query.tenantId : undefined;
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

  public static async verify(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = typeof request.query.tenantId === "string" ? request.query.tenantId : undefined;
      const result = await ComplianceLedgerService.validateLedger(tenantId);
      
      reply.status(200).send(result);
    } catch (error: any) {
      Logger.error({ context: "ComplianceController", message: "Error verifying ledger:", error: error });
      reply.status(500).send({ error: "Failed to run cryptographic validation on compliance ledger." });
    }
  }

  public static async reconstruct(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = typeof request.query.tenantId === "string" ? request.query.tenantId : "tenant-1";
      const timestamp = typeof request.query.timestamp === "string" ? request.query.timestamp : undefined;
      const result = await ComplianceLedgerService.reconstructState(tenantId, timestamp);
      reply.status(200).send(result);
    } catch (error: any) {
      Logger.error({ context: "ComplianceController", message: "Error reconstructing state:", error: error });
      reply.status(500).send({ error: "Failed to reconstruct state." });
    }
  }

  public static async replay(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = typeof request.query.tenantId === "string" ? request.query.tenantId : "tenant-1";
      const timestamp = typeof request.query.timestamp === "string" ? request.query.timestamp : undefined;
      const result = await ComplianceLedgerService.replayAudit(tenantId, timestamp);
      reply.status(200).send(result);
    } catch (error: any) {
      Logger.error({ context: "ComplianceController", message: "Error replaying audit log:", error: error });
      reply.status(500).send({ error: "Failed to replay audit log." });
    }
  }
}

