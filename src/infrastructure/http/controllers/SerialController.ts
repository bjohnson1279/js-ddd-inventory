import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { prisma } from "../../database/prisma";
import { ISerializedItemRepository } from "../../../domain/repositories/ISerializedItemRepository";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { SerializedInventoryService } from "../../../domain/serial/services/SerializedInventoryService";
import { SerialNumber } from "../../../domain/serial/valueObjects/SerialNumber";
import { DomainException } from "../../../domain/exceptions/DomainException";
import { Logger } from "../../../infrastructure/logging/logger";

export class SerialController {
  private static getService(request: FastifyRequest): SerializedInventoryService {
    const serials = (request.server as any).serializedItemRepository as ISerializedItemRepository;
    const inventory = (request.server as any).inventoryRepository as IInventoryRepository;
    return new SerializedInventoryService(serials, inventory);
  }

  static async register(request: any, reply: any) {
    try {
      const service = SerialController.getService(request);
      const { serialNumber, variantId, tenantId, locationId, actorId } =
        (request.body as any);

      if (!serialNumber || !variantId || !locationId || !actorId) {
        return reply.status(400).send({ error: "Missing registration fields." });
      }

      const serial = new SerialNumber(serialNumber);
      const item = await service.register(
        serial,
        variantId,
        tenantId || "DEFAULT",
        locationId,
        actorId,
      );

      reply
        .status(201)
        .send({
          message: "Serial number registered.",
          id: item.id,
          serialNumber: item.serialNumber.value,
        });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "SerialController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "SerialController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async receive(request: any, reply: any) {
    try {
      const service = SerialController.getService(request);
      const { serialNumber, tenantId, locationId, purchaseOrderId, actorId } =
        (request.body as any);

      if (!serialNumber || !locationId || !purchaseOrderId || !actorId) {
        return reply.status(400).send({ error: "Missing receipt parameters." });
      }

      const serial = new SerialNumber(serialNumber);
      await service.receive(
        serial,
        tenantId || "DEFAULT",
        locationId,
        purchaseOrderId,
        actorId,
      );

      reply
        .status(200)
        .send({ message: "Serial number received and stock incremented." });
    } catch (error: any) {
      if (
        error instanceof DomainException ||
        (typeof error?.message === "string" && error.message.includes("not found"))
      ) {
        Logger.error({ context: "SerialController", message: error instanceof DomainException ? error.message : error });
      reply.status(400).send({ error: "Not found" });
      } else {
        Logger.error({ context: "SerialController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async sell(request: any, reply: any) {
    try {
      const service = SerialController.getService(request);
      const { serialNumber, tenantId, saleId, actorId } = (request.body as any);

      if (!serialNumber || !saleId || !actorId) {
        return reply.status(400).send({ error: "Missing sales parameters." });
      }

      const serial = new SerialNumber(serialNumber);
      await service.sell(serial, tenantId || "DEFAULT", saleId, actorId);

      reply
        .status(200)
        .send({ message: "Serial number sold and stock decremented." });
    } catch (error: any) {
      if (
        error instanceof DomainException ||
        (typeof error?.message === "string" && error.message.includes("not found"))
      ) {
        Logger.error({ context: "SerialController", message: error instanceof DomainException ? error.message : error });
      reply.status(400).send({ error: "Not found" });
      } else {
        Logger.error({ context: "SerialController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async acceptReturn(request: any, reply: any) {
    try {
      const service = SerialController.getService(request);
      const { serialNumber, tenantId, returnId, actorId } = (request.body as any);

      if (!serialNumber || !returnId || !actorId) {
        return reply.status(400).send({ error: "Missing return parameters." });
      }

      const serial = new SerialNumber(serialNumber);
      await service.acceptReturn(
        serial,
        tenantId || "DEFAULT",
        returnId,
        actorId,
      );

      reply.status(200).send({ message: "Serial return accepted." });
    } catch (error: any) {
      Logger.error({ context: "SerialController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async restock(request: any, reply: any) {
    try {
      const service = SerialController.getService(request);
      const { serialNumber, tenantId, returnId, actorId } = (request.body as any);

      if (!serialNumber || !returnId || !actorId) {
        return reply.status(400).send({ error: "Missing restock parameters." });
      }

      const serial = new SerialNumber(serialNumber);
      await service.restock(serial, tenantId || "DEFAULT", returnId, actorId);

      reply
        .status(200)
        .send({ message: "Serial number restocked and stock incremented." });
    } catch (error: any) {
      Logger.error({ context: "SerialController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async getHistory(request: any, reply: any) {
    try {
      const serials = (request.server as any).serializedItemRepository as ISerializedItemRepository;
      const { serialNumber } = (request.params as any);
      if ((request.query as any).tenantId !== undefined && typeof (request.query as any).tenantId !== "string") {
        return reply.status(400).send({ error: "Invalid tenantId parameter" });
      }
      const tenantId = (request.query as any).tenantId ? ((request.query as any).tenantId as string).trim() : "DEFAULT";

      if (!serialNumber) {
        return reply
          .status(400)
          .send({ error: "Missing serial number parameter." });
      }

      const serial = new SerialNumber(serialNumber);
      const item = await serials.findBySerial(serial, tenantId);

      if (!item) {
        return reply
          .status(404)
          .send({ error: `Serial number ${serialNumber} not registered.` });
      }

      reply.status(200).send({
        id: item.id,
        serialNumber: item.serialNumber.value,
        variantId: item.variantId,
        status: item.status,
        locationId: item.locationId,
        history: item.history.map((t) => ({
          from: t.from,
          to: t.to,
          reason: t.reason,
          actor: t.actor,
          referenceId: t.referenceId,
          occurredAt: t.occurredAt,
        })),
      });
    } catch (error: any) {
      Logger.error({ context: "SerialController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async list(request: any, reply: any) {
    try {
      const records = await prisma.serializedItemModel.findMany({
        include: { transitions: true },
      });
      reply.status(200).send(
        records.map((item) => ({
          id: item.id,
          serialNumber: item.serialNumber,
          sku: item.sku,
          status: item.status,
          locationId: item.locationId,
          tenantId: item.tenantId,
          registeredAt: item.registeredAt,
          history: item.transitions.map((t) => ({
            from: t.fromStatus,
            to: t.toStatus,
            reason: t.reason,
            actor: t.actorId,
            referenceId: t.referenceId,
            occurredAt: t.transitionedAt,
          })),
        })),
      );
    } catch (error: any) {
      Logger.error({ context: "SerialController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }
}
