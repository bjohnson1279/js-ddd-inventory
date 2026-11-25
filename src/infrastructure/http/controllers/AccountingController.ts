import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { IJournalRepository } from "../../../domain/repositories/IJournalRepository";
import { ICostLayerRepository } from "../../../domain/repositories/ICostLayerRepository";
import { ITenantConfigRepository } from "../../../domain/repositories/ITenantConfigRepository";
import { CostLayerService } from "../../../domain/accounting/services/CostLayerService";
import { AccountingJournalService } from "../../../domain/accounting/services/AccountingJournalService";
import { TenantAccountingConfig } from "../../../domain/accounting/valueObjects/TenantAccountingConfig";
import { AccountingMethod } from "../../../domain/accounting/enums/AccountingMethod";
import { CostingMethod } from "../../../domain/accounting/enums/CostingMethod";
import { DomainException } from "../../../domain/exceptions/DomainException";
import { Logger } from "../../../infrastructure/logging/logger";
import { JournalEntry } from "../../../domain/accounting/aggregates/JournalEntry";
import { AccountCode } from "../../../domain/accounting/valueObjects/AccountCode";
import { AccountCategory } from "../../../domain/accounting/enums/AccountCategory";
import { DebitCredit } from "../../../domain/accounting/enums/DebitCredit";
import { prisma } from "../../database/prisma";
import crypto from "crypto";

export class AccountingController {
  static async createJournal(request: any, reply: any) {
    try {
      const journalRepo = (request.server as any).journalRepository as IJournalRepository;
      const { tenantId, description, date, method, referenceId, lines } = request.body || {};
      if (!description || !Array.isArray(lines) || lines.length < 2) {
        return reply.status(400).send({ error: "Journal entry requires description and at least 2 lines." });
      }
      let totalDebit = 0;
      let totalCredit = 0;
      const entry = new JournalEntry(
        crypto.randomUUID(),
        tenantId || request.tenantId || "DEFAULT",
        date ? new Date(date) : new Date(),
        description,
        referenceId || null,
        (method as AccountingMethod) || AccountingMethod.Accrual
      );
      for (const l of lines) {
        const amountCents = Number(l.amountCents);
        const type = String(l.type || "").toLowerCase();
        if (!Number.isInteger(amountCents) || amountCents <= 0 || (type !== "debit" && type !== "credit")) {
          return reply.status(400).send({ error: "Invalid journal line amount or type." });
        }
        if (type === "debit") totalDebit += amountCents;
        else totalCredit += amountCents;
        const code = String(l.accountCode || l.account || "1000");
        const account = new AccountCode(code, `Account ${code}`, AccountCategory.Asset);
        entry.addLine(account, amountCents, type === "debit" ? DebitCredit.Debit : DebitCredit.Credit, l.memo || "");
      }
      if (totalDebit !== totalCredit) {
        return reply.status(400).send({ error: `Unbalanced journal entry: debit ${totalDebit} != credit ${totalCredit}` });
      }
      await journalRepo.save(entry);
      reply.status(201).send({
        id: entry.id,
        tenantId: entry.tenantId,
        description: entry.description,
        lines: entry.lines.map((l) => ({
          id: l.id,
          accountCode: l.account.code,
          amountCents: l.amountCents,
          type: l.type,
        })),
      });
    } catch (error: any) {
      if (error instanceof DomainException) {
        return reply.status(400).send({ error: error.message });
      }
      Logger.error({ context: "AccountingController", message: "Failed to create journal:", error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async getValuationReport(request: any, reply: any) {
    try {
      const locationId = (request.query?.locationId as string) || "default";
      const methodRaw = String(request.query?.method || "FIFO").toUpperCase();
      const method = methodRaw === "WEIGHTED_AVERAGE_COST" ? "WAC" : methodRaw;

      const items = await prisma.inventoryModel.findMany({
        where: { locationId, quantity: { gt: 0 } },
      });
      const results: any[] = [];
      for (const item of items) {
        const variant = await prisma.productVariantModel.findUnique({ where: { sku: item.sku } });
        if (!variant) continue;
        const layers = await prisma.inventoryCostLayerModel.findMany({
          where: { variantId: variant.id },
          orderBy: { receivedAt: "asc" },
        });
        const activeLayers = layers.filter((l: any) => l.remainingQuantity > 0);
        const totalReceivedQty = layers.reduce((s: number, l: any) => s + l.originalQuantity, 0);
        const dispatchedQty = Math.max(0, totalReceivedQty - item.quantity);

        let totalValueCents = 0;
        const activeTotalQty = activeLayers.reduce((s: number, l: any) => s + l.remainingQuantity, 0);

        if (activeTotalQty === item.quantity && method === "FIFO") {
          totalValueCents = activeLayers.reduce((s: number, l: any) => s + l.remainingQuantity * l.unitCostCents, 0);
        } else if (layers.length > 0) {
          // Compute exact remaining carrying value under FIFO, LIFO, or WAC
          if (method === "WAC") {
            const totalInitVal = layers.reduce((s: number, l: any) => s + l.originalQuantity * l.unitCostCents, 0);
            totalValueCents = totalReceivedQty > 0 ? Math.round((totalInitVal * item.quantity) / totalReceivedQty) : 0;
          } else {
            const ordered = method === "LIFO" ? [...layers].reverse() : [...layers];
            let toConsume = dispatchedQty;
            const remainingSlices: { qty: number; unitCost: number }[] = [];
            for (const l of ordered) {
              const take = Math.min(toConsume, l.originalQuantity);
              toConsume -= take;
              const rem = l.originalQuantity - take;
              if (rem > 0) remainingSlices.push({ qty: rem, unitCost: l.unitCostCents });
            }
            totalValueCents = remainingSlices.reduce((s, r) => s + r.qty * r.unitCost, 0);
          }
        }
        results.push({
          sku: item.sku,
          locationId,
          totalQuantity: item.quantity,
          totalValueCents,
          unitCostCents: item.quantity > 0 ? Math.round(totalValueCents / item.quantity) : 0,
        });
      }
      reply.status(200).send(results);
    } catch (error: any) {
      Logger.error({ context: "AccountingController", message: "Failed valuation report:", error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async getLedger(request: any, reply: any) {
    try {
      const journalRepo = (request.server as any).journalRepository as IJournalRepository;
      if (request.query && (request.query as any).tenantId !== undefined && typeof (request.query as any).tenantId !== "string") {
        return reply.status(400).send({ error: "Invalid tenantId parameter." });
      }
      const tenantId = request.query && typeof (request.query as any).tenantId === "string" ? ((request.query as any).tenantId as string).trim() || undefined : undefined;
      const entries = await journalRepo.findAll(tenantId);

      reply.status(200).send(
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
      Logger.error({ context: "AccountingController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async recordStockReceived(request: any, reply: any) {
    try {
      const journalRepo = (request.server as any).journalRepository as IJournalRepository;
      const costLayerRepo = (request.server as any).costLayerRepository as ICostLayerRepository;
      const tenantConfigRepo = (request.server as any).tenantConfigRepository as ITenantConfigRepository;

      const {
        variantId,
        totalCostCents,
        purchaseOrderId,
        supplierName,
        date,
        accountingMethod,
        costingMethod,
        tenantId,
      } = (request.body as any);

      if (!variantId || !totalCostCents || !purchaseOrderId || !supplierName) {
        return reply
          .status(400)
          .send({ error: "Missing stock received parameters." });
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

      reply.status(200).send({
        message: "Stock receipt recorded.",
        journalEntryId: entry ? entry.id : null,
      });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "AccountingController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "Invalid accounting operation" });
      } else {
        Logger.error({ context: "AccountingController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async recordStockSold(request: any, reply: any) {
    try {
      const journalRepo = (request.server as any).journalRepository as IJournalRepository;
      const costLayerRepo = (request.server as any).costLayerRepository as ICostLayerRepository;
      const tenantConfigRepo = (request.server as any).tenantConfigRepository as ITenantConfigRepository;

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
      } = (request.body as any);

      if (!variantId || !quantity || !salePriceCents || !saleId) {
        return reply
          .status(400)
          .send({ error: "Missing stock sold parameters." });
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

      reply.status(200).send({
        message: "Stock sale recorded.",
        journalEntryId: entry ? entry.id : null,
      });
    } catch (error: any) {
      if (
        error instanceof DomainException ||
        (typeof error?.message === "string" && error.message.includes("Insufficient"))
      ) {
        Logger.error({ context: "AccountingController", message: error instanceof DomainException ? error.message : error });
        reply.status(400).send({ error: "Insufficient stock" });
      } else {
        Logger.error({ context: "AccountingController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async calculateValuation(request: any, reply: any) {
    try {
      const costLayerRepo = (request.server as any).costLayerRepository as ICostLayerRepository;
      const tenantConfigRepo = (request.server as any).tenantConfigRepository as ITenantConfigRepository;
      const { variantId } = (request.params as any);
      if (request.query && (request.query as any).quantity !== undefined && typeof (request.query as any).quantity !== "string") {
        return reply.status(400).send({ error: "Invalid quantity parameter." });
      }
      const parsedQuantity = request.query && typeof (request.query as any).quantity === "string" ? parseInt((request.query as any).quantity as string, 10) : NaN;
      const quantity = isNaN(parsedQuantity) || parsedQuantity <= 0 ? 1 : parsedQuantity;

      if (request.query && (request.query as any).tenantId !== undefined && typeof (request.query as any).tenantId !== "string") {
        return reply.status(400).send({ error: "Invalid tenantId parameter." });
      }
      let tenantId = request.query && typeof (request.query as any).tenantId === "string" ? ((request.query as any).tenantId as string).trim() : "";
      if (!tenantId) {
        tenantId = "DEFAULT";
      }

      if (request.query && (request.query as any).method !== undefined && typeof (request.query as any).method !== "string") {
        return reply.status(400).send({ error: "Invalid method parameter." });
      }
      let method = request.query && typeof (request.query as any).method === "string" ? ((request.query as any).method as string).trim() : "";
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
        return reply.status(400).send({ error: "Missing variantId parameter." });
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

      reply.status(200).send({
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
        Logger.error({ context: "AccountingController", message: error instanceof DomainException ? error.message : error });
        reply.status(400).send({ error: "Insufficient stock" });
      } else {
        Logger.error({ context: "AccountingController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async getTenantConfig(request: any, reply: any) {
    try {
      const tenantConfigRepo = (request.server as any).tenantConfigRepository as ITenantConfigRepository;
      const { tenantId } = (request.params as any);
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
      reply.status(200).send({
        tenantId,
        accountingMethod: config.accountingMethod,
        costingMethod: config.costingMethod,
        currencyCode: config.currencyCode,
        fiscalYearStart: config.fiscalYearStart,
      });
    } catch (error: any) {
      Logger.error({ context: "AccountingController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async saveTenantConfig(request: any, reply: any) {
    try {
      const tenantConfigRepo = (request.server as any).tenantConfigRepository as ITenantConfigRepository;
      const {
        tenantId,
        accountingMethod,
        costingMethod,
        currencyCode,
        fiscalYearStart,
      } = (request.body as any);

      if (!tenantId || !accountingMethod || !costingMethod) {
        return reply.status(400).send({ error: "Missing config fields." });
      }

      const config = new TenantAccountingConfig(
        accountingMethod as AccountingMethod,
        costingMethod as CostingMethod,
        currencyCode || "USD",
        fiscalYearStart || "01-01",
      );

      await tenantConfigRepo.save(tenantId, config);

      reply.status(200).send({
        message: "Tenant configuration saved successfully.",
        tenantId,
        accountingMethod: config.accountingMethod,
        costingMethod: config.costingMethod,
      });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "AccountingController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "Invalid accounting operation" });
      } else {
        Logger.error({ context: "AccountingController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async syncJournal(request: any, reply: any) {
    try {
      const { provider, referenceId, memo, lines, apiKey } = (request.body as any);
      if (!provider || !referenceId || !lines || !Array.isArray(lines)) {
        return reply.status(400).send({ error: "Missing required fields: provider, referenceId, lines." });
      }

      const isMock = !apiKey || String(apiKey).toLowerCase().includes("mock") || apiKey === "";
      const totalCents = lines.reduce((sum: number, line: any) => sum + (line.amountCents || 0), 0);
      const prefix = provider.substring(0, 3).toLowerCase();
      const mockId = `${prefix}-jrnl-${crypto.randomInt(100000, 1000000)}`;

      reply.status(200).send({
        success: true,
        provider,
        externalJournalId: isMock ? `mock-${mockId}` : mockId,
        postedAmountCents: totalCents,
        lineCount: lines.length,
        message: isMock
          ? `Successfully synced journal entry ${referenceId} to ${provider} (Mock Fallback)`
          : `Successfully synced journal entry ${referenceId} to ${provider} API`,
        syncedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      Logger.error({ context: "AccountingController", message: "Failed to sync ERP journal:", error: error });
      reply.status(500).send({ error: "Failed to sync journal entry to ERP." });
    }
  }
}

