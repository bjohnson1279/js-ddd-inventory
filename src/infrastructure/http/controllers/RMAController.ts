import { DomainException } from "../../../domain/exceptions/DomainException";

import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { CreateRMA } from "../../../application/useCases/CreateRMA";
import { AuthorizeRMA } from "../../../application/useCases/AuthorizeRMA";
import { ReceiveRMA } from "../../../application/useCases/ReceiveRMA";
import { IRMARepository } from "../../../domain/repositories/IRMARepository";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../../domain/repositories/ICostLayerRepository";
import { IQuarantineRepository } from "../../../domain/repositories/IQuarantineRepository";
import { ITenantConfigRepository } from "../../../domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../../domain/repositories/IJournalRepository";
import { ISerializedItemRepository } from "../../../domain/repositories/ISerializedItemRepository";
import { Logger } from "../../../infrastructure/logging/logger";

export class RMAController {
  static async create(request: any, reply: any) {
    try {
      const rmaRepository = (request.server as any)["rmaRepository"] as IRMARepository;
      const useCase = new CreateRMA(rmaRepository);

      const rma = await useCase.execute((request.body as any));
      reply.status(201).send({
        id: rma.id,
        rmaNumber: rma.rmaNumber,
        tenantId: rma.tenantId,
        customerId: rma.customerId,
        locationId: rma.locationId,
        status: rma.status,
        items: rma.items.map((i) => ({
          id: i.id,
          variantId: i.variantId,
          quantity: i.quantity,
          receivedQuantity: i.receivedQuantity,
          unitCostCents: i.unitCostCents,
          status: i.status,
          disposition: i.disposition,
        })),
      });
    } catch (error: any) {
      Logger.error({ context: "RMAController", message: "An error occurred", error: error });
      reply.status(400).send({ error: "Bad request" });
    }
  }

  static async authorize(request: any, reply: any) {
    try {
      const rmaRepository = (request.server as any)["rmaRepository"] as IRMARepository;
      const useCase = new AuthorizeRMA(rmaRepository);

      await useCase.execute((request.params as any).id);
      reply.status(200).send({ message: "RMA authorized successfully" });
    } catch (error: any) {
      Logger.error({ context: "RMAController", message: "An error occurred", error: error });
      Logger.error({ context: "RMAController", message: error instanceof DomainException ? error.message : error });
      reply.status(400).send({ error: "Bad request" });
    }
  }

  static async receive(request: any, reply: any) {
    try {
      const rmaRepository = (request.server as any)["rmaRepository"] as IRMARepository;
      const inventoryRepository = (request.server as any)["inventoryRepository"] as IInventoryRepository;
      const costLayerRepository = (request.server as any)["costLayerRepository"] as ICostLayerRepository;
      const quarantineRepository = (request.server as any)["quarantineRepository"] as IQuarantineRepository;
      const tenantConfigRepository = (request.server as any)["tenantConfigRepository"] as ITenantConfigRepository;
      const journalRepository = (request.server as any)["journalRepository"] as IJournalRepository;
      const serializedItemRepository = (request.server as any)["serializedItemRepository"] as ISerializedItemRepository;

      const useCase = new ReceiveRMA(
        rmaRepository,
        inventoryRepository,
        costLayerRepository,
        quarantineRepository,
        tenantConfigRepository,
        journalRepository,
        serializedItemRepository
      );

      await useCase.execute({
        rmaId: (request.params as any).id,
        items: (request.body as any).items,
      });

      reply.status(200).send({ message: "RMA items received and processed successfully" });
    } catch (error: any) {
      Logger.error({ context: "RMAController", message: "An error occurred", error: error });
      Logger.error({ context: "RMAController", message: error instanceof DomainException ? error.message : error });
      reply.status(400).send({ error: "Bad request" });
    }
  }

  static async get(request: any, reply: any) {
    try {
      const rmaRepository = (request.server as any)["rmaRepository"] as IRMARepository;
      const rma = await rmaRepository.findById((request.params as any).id);
      if (!rma) {
        return reply.status(404).send({ error: "RMA not found" });
      }

      reply.status(200).send({
        id: rma.id,
        rmaNumber: rma.rmaNumber,
        tenantId: rma.tenantId,
        customerId: rma.customerId,
        locationId: rma.locationId,
        status: rma.status,
        items: rma.items.map((i) => ({
          id: i.id,
          variantId: i.variantId,
          quantity: i.quantity,
          receivedQuantity: i.receivedQuantity,
          unitCostCents: i.unitCostCents,
          status: i.status,
          disposition: i.disposition,
        })),
      });
    } catch (error: any) {
      Logger.error({ context: "RMAController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }
}
