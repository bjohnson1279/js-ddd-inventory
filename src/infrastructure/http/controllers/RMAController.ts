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
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const rmaRepository = request.server["rmaRepository"] as IRMARepository;
      const useCase = new CreateRMA(rmaRepository);

      const rma = await useCase.execute(request.body);
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

  static async authorize(request: FastifyRequest, reply: FastifyReply) {
    try {
      const rmaRepository = request.server["rmaRepository"] as IRMARepository;
      const useCase = new AuthorizeRMA(rmaRepository);

      await useCase.execute(request.params.id);
      reply.status(200).send({ message: "RMA authorized successfully" });
    } catch (error: any) {
      Logger.error({ context: "RMAController", message: "An error occurred", error: error });
      Logger.error({ context: "RMAController", message: error instanceof DomainException ? error.message : error });
      reply.status(400).send({ error: "Bad request" });
    }
  }

  static async receive(request: FastifyRequest, reply: FastifyReply) {
    try {
      const rmaRepository = request.server["rmaRepository"] as IRMARepository;
      const inventoryRepository = request.server["inventoryRepository"] as IInventoryRepository;
      const costLayerRepository = request.server["costLayerRepository"] as ICostLayerRepository;
      const quarantineRepository = request.server["quarantineRepository"] as IQuarantineRepository;
      const tenantConfigRepository = request.server["tenantConfigRepository"] as ITenantConfigRepository;
      const journalRepository = request.server["journalRepository"] as IJournalRepository;
      const serializedItemRepository = request.server["serializedItemRepository"] as ISerializedItemRepository;

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
        rmaId: request.params.id,
        items: request.body.items,
      });

      reply.status(200).send({ message: "RMA items received and processed successfully" });
    } catch (error: any) {
      Logger.error({ context: "RMAController", message: "An error occurred", error: error });
      Logger.error({ context: "RMAController", message: error instanceof DomainException ? error.message : error });
      reply.status(400).send({ error: "Bad request" });
    }
  }

  static async get(request: FastifyRequest, reply: FastifyReply) {
    try {
      const rmaRepository = request.server["rmaRepository"] as IRMARepository;
      const rma = await rmaRepository.findById(request.params.id);
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
