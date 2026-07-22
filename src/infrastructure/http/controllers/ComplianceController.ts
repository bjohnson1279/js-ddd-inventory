import { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { ComplianceLedgerService } from "../../../domain/services/ComplianceLedgerService";
import { Logger } from "../../../infrastructure/logging/logger";

export class ComplianceController {
  public static async list(req: Request, res: Response) {
    try {
      const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
      const ledger = await prisma.complianceLedgerModel.findMany({
        where: tenantId ? { tenantId } : undefined,
        orderBy: { sequenceNumber: "desc" }
      });

      res.status(200).json(ledger);
    } catch (error: any) {
      Logger.error({ context: "ComplianceController", message: "Error listing ledger:", error: error });
      res.status(500).json({ error: "Failed to load compliance ledger." });
    }
  }

  public static async verify(req: Request, res: Response) {
    try {
      const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
      const result = await ComplianceLedgerService.validateLedger(tenantId);
      
      res.status(200).json(result);
    } catch (error: any) {
      Logger.error({ context: "ComplianceController", message: "Error verifying ledger:", error: error });
      res.status(500).json({ error: "Failed to run cryptographic validation on compliance ledger." });
    }
  }
}
