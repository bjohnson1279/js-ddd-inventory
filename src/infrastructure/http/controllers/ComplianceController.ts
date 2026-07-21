import { Logger } from "../../logging/logger";
import { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { ComplianceLedgerService } from "../../../domain/services/ComplianceLedgerService";

export class ComplianceController {
  public static async list(req: Request, res: Response) {
    try {
      const tenantId = (req.query.tenantId as string) || undefined;
      const ledger = await prisma.complianceLedgerModel.findMany({
        where: tenantId ? { tenantId } : undefined,
        orderBy: { sequenceNumber: "desc" }
      });

      res.status(200).json(ledger);
    } catch (error: any) {
      Logger.error({ context: "ComplianceController", message: "[ComplianceController] Error listing ledger:" }, error);
      res.status(500).json({ error: "Failed to load compliance ledger." });
    }
  }

  public static async verify(req: Request, res: Response) {
    try {
      const tenantId = (req.query.tenantId as string) || undefined;
      const result = await ComplianceLedgerService.validateLedger(tenantId);
      
      res.status(200).json(result);
    } catch (error: any) {
      Logger.error({ context: "ComplianceController", message: "[ComplianceController] Error verifying ledger:" }, error);
      res.status(500).json({ error: "Failed to run cryptographic validation on compliance ledger." });
    }
  }
}
