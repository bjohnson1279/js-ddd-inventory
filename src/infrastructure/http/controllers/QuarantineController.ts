import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { ResolveQuarantineItem } from "../../../application/useCases/ResolveQuarantineItem";
import { IQuarantineRepository } from "../../../domain/repositories/IQuarantineRepository";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../../domain/repositories/ICostLayerRepository";
import { ITenantConfigRepository } from "../../../domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../../domain/repositories/IJournalRepository";
import { Logger } from "../../../infrastructure/logging/logger";

export class QuarantineController {
  static async resolve(request: FastifyRequest, reply: FastifyReply) {
    try {
      const quarantineRepository = request.server["quarantineRepository"] as IQuarantineRepository;
      const inventoryRepository = request.server["inventoryRepository"] as IInventoryRepository;
      const costLayerRepository = request.server["costLayerRepository"] as ICostLayerRepository;
      const tenantConfigRepository = request.server["tenantConfigRepository"] as ITenantConfigRepository;
      const journalRepository = request.server["journalRepository"] as IJournalRepository;

      const useCase = new ResolveQuarantineItem(
        quarantineRepository,
        inventoryRepository,
        costLayerRepository,
        tenantConfigRepository,
        journalRepository
      );

      await useCase.execute({
        quarantineItemId: request.params.id,
        resolution: request.body.resolution,
      });

      reply.status(200).send({ message: "Quarantine item resolved successfully" });
    } catch (error: any) {
      Logger.error({ context: "QuarantineController", message: "An error occurred", error: error });
      reply.status(400).send({ error: "Bad request" });
    }
  }

  static async get(request: FastifyRequest, reply: FastifyReply) {
    try {
      const quarantineRepository = request.server["quarantineRepository"] as IQuarantineRepository;
      const item = await quarantineRepository.findById(request.params.id);
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

  static async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const quarantineRepository = request.server["quarantineRepository"] as IQuarantineRepository;
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
