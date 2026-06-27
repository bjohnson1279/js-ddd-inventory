import { Request, Response } from "express";
import { IJournalRepository } from "../../../domain/repositories/IJournalRepository";
import { ICostLayerRepository } from "../../../domain/repositories/ICostLayerRepository";
import { ITenantConfigRepository } from "../../../domain/repositories/ITenantConfigRepository";
import { CostLayerService } from "../../../domain/accounting/services/CostLayerService";
import { AccountingJournalService } from "../../../domain/accounting/services/AccountingJournalService";
import { TenantAccountingConfig } from "../../../domain/accounting/valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../../../domain/accounting/enums/AccountingMethod";
import { CostingMethod } from "../../../domain/accounting/enums/CostingMethod";
import { DomainException } from "../../../domain/exceptions/DomainException";

export class AccountingController {
  static async getLedger(req: Request, res: Response) {
    try {
      const journalRepo = req.app.get(
        "journalRepository",
      ) as IJournalRepository;
      if (req.query.tenantId !== undefined && typeof req.query.tenantId !== "string") {
        return res.status(400).json({ error: "Invalid tenantId parameter." });
      }
      const tenantId = req.query.tenantId ? (req.query.tenantId as string).trim() || undefined : undefined;
      const entries = await journalRepo.findAll(tenantId);

      res.status(200).json(
        entries.map((entry) => ({
          id: entry.id,
          tenantId: entry.tenantId,
          date: entry.date,
          description: entry.description,
          referenceId: entry.referenceId,
          method: entry.method,
          lines: entry.lines.map((l) => ({
            id: l.id,
            account: {
              code: l.account.code,
              name: l.account.name,
              category: l.account.category,
            },
            amountCents: l.amountCents,
            type: l.type,
            memo: l.memo,
          })),
        })),
      );
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async recordStockReceived(req: Request, res: Response) {
    try {
      const journalRepo = req.app.get(
        "journalRepository",
      ) as IJournalRepository;
      const costLayerRepo = req.app.get(
        "costLayerRepository",
      ) as ICostLayerRepository;
      const tenantConfigRepo = req.app.get(
        "tenantConfigRepository",
      ) as ITenantConfigRepository;

      const {
        variantId,
        totalCostCents,
        purchaseOrderId,
        supplierName,
        date,
        accountingMethod,
        costingMethod,
        tenantId,
      } = req.body;

      if (!variantId || !totalCostCents || !purchaseOrderId || !supplierName) {
        return res
          .status(400)
          .json({ error: "Missing stock received parameters." });
      }

      const costLayerService = new CostLayerService(costLayerRepo);
      const journalService = new AccountingJournalService(
        journalRepo,
        costLayerService,
      );

      const activeTenantId = tenantId || "DEFAULT";
      let config = await tenantConfigRepo.findByTenantId(activeTenantId);
      if (!config) {
        config = new TenantAccountingConfig(
          (accountingMethod as AccountingMethod) || AccountingMethod.Accrual,
          (costingMethod as CostingMethod) || CostingMethod.FIFO,
          "USD",
          "01-01",
        );
        await tenantConfigRepo.save(activeTenantId, config);
      }

      const entry = await journalService.onStockReceived(
        variantId,
        totalCostCents,
        purchaseOrderId,
        supplierName,
        date ? new Date(date) : new Date(),
        config,
        tenantId || "DEFAULT",
      );

      res.status(200).json({
        message: "Stock receipt recorded.",
        journalEntryId: entry ? entry.id : null,
      });
    } catch (error: any) {
      if (error instanceof DomainException) {
        console.error(error.message);
        res.status(400).json({ error: "Invalid accounting operation" });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async recordStockSold(req: Request, res: Response) {
    try {
      const journalRepo = req.app.get(
        "journalRepository",
      ) as IJournalRepository;
      const costLayerRepo = req.app.get(
        "costLayerRepository",
      ) as ICostLayerRepository;
      const tenantConfigRepo = req.app.get(
        "tenantConfigRepository",
      ) as ITenantConfigRepository;

      const {
        variantId,
        quantity,
        salePriceCents,
        paymentReceivedNow,
        customerName,
        saleId,
        date,
        accountingMethod,
        costingMethod,
        tenantId,
      } = req.body;

      if (!variantId || !quantity || !salePriceCents || !saleId) {
        return res
          .status(400)
          .json({ error: "Missing stock sold parameters." });
      }

      const costLayerService = new CostLayerService(costLayerRepo);
      const journalService = new AccountingJournalService(
        journalRepo,
        costLayerService,
      );

      const activeTenantId = tenantId || "DEFAULT";
      let config = await tenantConfigRepo.findByTenantId(activeTenantId);
      if (!config) {
        config = new TenantAccountingConfig(
          (accountingMethod as AccountingMethod) || AccountingMethod.Accrual,
          (costingMethod as CostingMethod) || CostingMethod.FIFO,
          "USD",
          "01-01",
        );
        await tenantConfigRepo.save(activeTenantId, config);
      }

      const entry = await journalService.onStockSold(
        variantId,
        quantity,
        salePriceCents,
        paymentReceivedNow === undefined ? true : paymentReceivedNow,
        customerName || null,
        saleId,
        date ? new Date(date) : new Date(),
        config,
        tenantId || "DEFAULT",
      );

      res.status(200).json({
        message: "Stock sale recorded.",
        journalEntryId: entry ? entry.id : null,
      });
    } catch (error: any) {
      if (
        error instanceof DomainException ||
        (typeof error?.message === "string" && error.message.includes("Insufficient"))
      ) {
        console.error(error instanceof DomainException ? error.message : error);
        res.status(400).json({ error: "Insufficient stock" });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async calculateValuation(req: Request, res: Response) {
    try {
      const costLayerRepo = req.app.get(
        "costLayerRepository",
      ) as ICostLayerRepository;
      const tenantConfigRepo = req.app.get(
        "tenantConfigRepository",
      ) as ITenantConfigRepository;
      const { variantId } = req.params;
      if (req.query.quantity !== undefined && typeof req.query.quantity !== "string") {
        return res.status(400).json({ error: "Invalid quantity parameter." });
      }
      const parsedQuantity = req.query.quantity !== undefined ? parseInt(req.query.quantity as string, 10) : NaN;
      const quantity = isNaN(parsedQuantity) || parsedQuantity <= 0 ? 1 : parsedQuantity;

      if (req.query.tenantId !== undefined && typeof req.query.tenantId !== "string") {
        return res.status(400).json({ error: "Invalid tenantId parameter." });
      }
      let tenantId = req.query.tenantId ? (req.query.tenantId as string).trim() : "";
      if (!tenantId) {
        tenantId = "DEFAULT";
      }

      if (req.query.method !== undefined && typeof req.query.method !== "string") {
        return res.status(400).json({ error: "Invalid method parameter." });
      }
      let method = req.query.method ? (req.query.method as string).trim() : "";
      if (!method) {
        const config = await tenantConfigRepo.findByTenantId(tenantId);
        if (config) {
          method =
            config.costingMethod === CostingMethod.WeightedAverageCost
              ? "wac"
              : "fifo";
        } else {
          method = "fifo";
        }
      }
      method = method.toLowerCase();

      if (!variantId) {
        return res.status(400).json({ error: "Missing variantId parameter." });
      }

      const service = new CostLayerService(costLayerRepo);
      let breakdown;

      if (
        method === "wac" ||
        method === "weighted_average" ||
        method === "weighted_average_cost"
      ) {
        breakdown = await service.calculateWeightedAverageCost(
          variantId,
          quantity,
        );
      } else {
        breakdown = await service.calculateFifoCost(variantId, quantity);
      }

      res.status(200).json({
        variantId,
        quantity: breakdown.units,
        totalCostCents: breakdown.totalCostCents,
        unitCostCents: breakdown.unitCostCents,
        methodUsed: method,
      });
    } catch (error: any) {
      if (
        error instanceof DomainException ||
        (typeof error?.message === "string" && error.message.includes("Insufficient"))
      ) {
        console.error(error instanceof DomainException ? error.message : error);
        res.status(400).json({ error: "Insufficient stock" });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async getTenantConfig(req: Request, res: Response) {
    try {
      const tenantConfigRepo = req.app.get(
        "tenantConfigRepository",
      ) as ITenantConfigRepository;
      const { tenantId } = req.params;
      let config = await tenantConfigRepo.findByTenantId(tenantId);
      if (!config) {
        config = new TenantAccountingConfig(
          AccountingMethod.Accrual,
          CostingMethod.FIFO,
          "USD",
          "01-01",
        );
        await tenantConfigRepo.save(tenantId, config);
      }
      res.status(200).json({
        tenantId,
        accountingMethod: config.accountingMethod,
        costingMethod: config.costingMethod,
        currencyCode: config.currencyCode,
        fiscalYearStart: config.fiscalYearStart,
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async saveTenantConfig(req: Request, res: Response) {
    try {
      const tenantConfigRepo = req.app.get(
        "tenantConfigRepository",
      ) as ITenantConfigRepository;
      const {
        tenantId,
        accountingMethod,
        costingMethod,
        currencyCode,
        fiscalYearStart,
      } = req.body;

      if (!tenantId || !accountingMethod || !costingMethod) {
        return res.status(400).json({ error: "Missing config fields." });
      }

      const config = new TenantAccountingConfig(
        accountingMethod as AccountingMethod,
        costingMethod as CostingMethod,
        currencyCode || "USD",
        fiscalYearStart || "01-01",
      );

      await tenantConfigRepo.save(tenantId, config);

      res.status(200).json({
        message: "Tenant configuration saved successfully.",
        tenantId,
        accountingMethod: config.accountingMethod,
        costingMethod: config.costingMethod,
      });
    } catch (error: any) {
      if (error instanceof DomainException) {
        console.error(error.message);
        res.status(400).json({ error: "Invalid accounting operation" });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
}
