import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { ResolveQuarantineItem } from "../../../application/useCases/ResolveQuarantineItem";
import { IQuarantineRepository } from "../../../domain/repositories/IQuarantineRepository";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../../domain/repositories/ICostLayerRepository";
import { ITenantConfigRepository } from "../../../domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../../domain/repositories/IJournalRepository";
import { Logger } from "../../../infrastructure/logging/logger";

export class QuarantineController {
  static async resolve(request: any, reply: any) {
    try {
      const quarantineRepository = (request.server as any)["quarantineRepository"] as IQuarantineRepository;
      const inventoryRepository = (request.server as any)["inventoryRepository"] as IInventoryRepository;
      const costLayerRepository = (request.server as any)["costLayerRepository"] as ICostLayerRepository;
      const tenantConfigRepository = (request.server as any)["tenantConfigRepository"] as ITenantConfigRepository;
      const journalRepository = (request.server as any)["journalRepository"] as IJournalRepository;

      const useCase = new ResolveQuarantineItem(
        quarantineRepository,
        inventoryRepository,
        costLayerRepository,
        tenantConfigRepository,
        journalRepository
      );

      await useCase.execute({
        quarantineItemId: (request.params as any).id,
        resolution: (request.body as any).resolution,
      });

      reply.status(200).send({ message: "Quarantine item resolved successfully" });
    } catch (error: any) {
      Logger.error({ context: "QuarantineController", message: "An error occurred", error: error });
      reply.status(400).send({ error: "Bad request" });
    }
  }

  static async get(request: any, reply: any) {
    try {
      const quarantineRepository = (request.server as any)["quarantineRepository"] as IQuarantineRepository;
      const item = await quarantineRepository.findById((request.params as any).id);
      if (!item) {
        return reply.status(404).send({ error: "Quarantine item not found" });
      }

      reply.status(200).send({
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        reason: item.reason,
        locationId: item.locationId,
        tenantId: item.tenantId,
        status: item.status,
        createdAt: item.createdAt,
        resolvedAt: item.resolvedAt,
      });
    } catch (error: any) {
      Logger.error({ context: "QuarantineController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async list(request: any, reply: any) {
    try {
      const quarantineRepository = (request.server as any)["quarantineRepository"] as IQuarantineRepository;
      const items = await quarantineRepository.findAll();

      reply.status(200).send(
        items.map((item) => ({
          id: item.id,
          variantId: item.variantId,
          quantity: item.quantity,
          reason: item.reason,
          locationId: item.locationId,
          tenantId: item.tenantId,
          status: item.status,
          createdAt: item.createdAt,
          resolvedAt: item.resolvedAt,
        }))
      );
    } catch (error: any) {
      Logger.error({ context: "QuarantineController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }
}
