import { DomainException } from "../../../domain/exceptions/DomainException";

import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { CreateInventoryAudit } from "../../../application/useCases/CreateInventoryAudit";
import { StartInventoryAudit } from "../../../application/useCases/StartInventoryAudit";
import { RecordAuditCount } from "../../../application/useCases/RecordAuditCount";
import { CompleteInventoryAudit } from "../../../application/useCases/CompleteInventoryAudit";
import { ReconcileInventoryAudit } from "../../../application/useCases/ReconcileInventoryAudit";
import { IInventoryAuditRepository } from "../../../domain/repositories/IInventoryAuditRepository";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../../domain/repositories/ICostLayerRepository";
import { ITenantConfigRepository } from "../../../domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../../domain/repositories/IJournalRepository";
import { Logger } from "../../../infrastructure/logging/logger";

export class InventoryAuditController {
  static async create(request: any, reply: any) {
    try {
      const auditRepository = (request.server as any)["inventoryAuditRepository"] as IInventoryAuditRepository;
      const inventoryRepository = (request.server as any)["inventoryRepository"] as IInventoryRepository;
      const useCase = new CreateInventoryAudit(auditRepository, inventoryRepository);

      const audit = await useCase.execute((request.body as any));
      reply.status(201).send({
        id: audit.id,
        auditNumber: audit.auditNumber,
        tenantId: audit.tenantId,
        locationId: audit.locationId,
        status: audit.status,
        createdAt: audit.createdAt,
        updatedAt: audit.updatedAt,
        items: audit.items.map(i => ({
          id: i.id,
          variantId: i.variantId,
          expectedQuantity: i.expectedQuantity,
          countedQuantity: i.countedQuantity,
          discrepancy: i.discrepancy,
          isCounted: i.isCounted
        }))
      });
    } catch (error: any) {
      Logger.error({ context: "InventoryAuditController", message: "An error occurred", error: error });
      reply.status(400).send({ error: "Bad request" });
    }
  }

  static async start(request: any, reply: any) {
    try {
      const auditRepository = (request.server as any)["inventoryAuditRepository"] as IInventoryAuditRepository;
      const useCase = new StartInventoryAudit(auditRepository);
      await useCase.execute((request.params as any).id);
      reply.status(200).send({ message: "Inventory audit started successfully" });
    } catch (error: any) {
      Logger.error({ context: "InventoryAuditController", message: "An error occurred", error: error });
      Logger.error({ context: "InventoryAuditController", message: error instanceof DomainException ? error.message : error });
      reply.status(400).send({ error: "Bad request" });
    }
  }

  static async recordCount(request: any, reply: any) {
    try {
      const auditRepository = (request.server as any)["inventoryAuditRepository"] as IInventoryAuditRepository;
      const useCase = new RecordAuditCount(auditRepository);
      await useCase.execute({
        auditId: (request.params as any).id,
        variantId: (request.body as any).variantId,
        countedQuantity: (request.body as any).countedQuantity
      });
      reply.status(200).send({ message: "Count recorded successfully" });
    } catch (error: any) {
      Logger.error({ context: "InventoryAuditController", message: "An error occurred", error: error });
      Logger.error({ context: "InventoryAuditController", message: error instanceof DomainException ? error.message : error });
      reply.status(400).send({ error: "Bad request" });
    }
  }

  static async complete(request: any, reply: any) {
    try {
      const auditRepository = (request.server as any)["inventoryAuditRepository"] as IInventoryAuditRepository;
      const useCase = new CompleteInventoryAudit(auditRepository);
      await useCase.execute((request.params as any).id);
      reply.status(200).send({ message: "Inventory audit completed successfully" });
    } catch (error: any) {
      Logger.error({ context: "InventoryAuditController", message: "An error occurred", error: error });
      Logger.error({ context: "InventoryAuditController", message: error instanceof DomainException ? error.message : error });
      reply.status(400).send({ error: "Bad request" });
    }
  }

  static async reconcile(request: any, reply: any) {
    try {
      const auditRepository = (request.server as any)["inventoryAuditRepository"] as IInventoryAuditRepository;
      const inventoryRepository = (request.server as any)["inventoryRepository"] as IInventoryRepository;
      const costLayerRepository = (request.server as any)["costLayerRepository"] as ICostLayerRepository;
      const tenantConfigRepository = (request.server as any)["tenantConfigRepository"] as ITenantConfigRepository;
      const journalRepository = (request.server as any)["journalRepository"] as IJournalRepository;

      const useCase = new ReconcileInventoryAudit(
        auditRepository,
        inventoryRepository,
        costLayerRepository,
        tenantConfigRepository,
        journalRepository
      );

      await useCase.execute((request.params as any).id);
      reply.status(200).send({ message: "Inventory audit reconciled successfully" });
    } catch (error: any) {
      Logger.error({ context: "InventoryAuditController", message: "An error occurred", error: error });
      Logger.error({ context: "InventoryAuditController", message: error instanceof DomainException ? error.message : error });
      reply.status(400).send({ error: "Bad request" });
    }
  }

  static async get(request: any, reply: any) {
    try {
      const auditRepository = (request.server as any)["inventoryAuditRepository"] as IInventoryAuditRepository;
      const audit = await auditRepository.findById((request.params as any).id);
      if (!audit) {
        return reply.status(404).send({ error: "Inventory audit not found" });
      }
      reply.status(200).send({
        id: audit.id,
        auditNumber: audit.auditNumber,
        tenantId: audit.tenantId,
        locationId: audit.locationId,
        status: audit.status,
        createdAt: audit.createdAt,
        updatedAt: audit.updatedAt,
        items: audit.items.map(i => ({
          id: i.id,
          variantId: i.variantId,
          expectedQuantity: i.expectedQuantity,
          countedQuantity: i.countedQuantity,
          discrepancy: i.discrepancy,
          isCounted: i.isCounted
        }))
      });
    } catch (error: any) {
      Logger.error({ context: "InventoryAuditController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }
}
