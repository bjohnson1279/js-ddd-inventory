import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { CreatePurchaseOrder } from "../../../application/useCases/CreatePurchaseOrder";
import { ReceivePurchaseOrder } from "../../../application/useCases/ReceivePurchaseOrder";
import { IPurchaseOrderRepository } from "../../../domain/repositories/IPurchaseOrderRepository";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../../domain/repositories/ICostLayerRepository";
import { DomainException } from "../../../domain/exceptions/DomainException";
import { AutoRetryDecorator } from "../../../application/decorators/AutoRetryDecorator";
import { Logger } from "../../../infrastructure/logging/logger";

export class PurchaseOrderController {
  static async create(request: any, reply: any) {
    try {
      const poRepository = (request.server as any)["purchaseOrderRepository"] as IPurchaseOrderRepository;
      const useCase = AutoRetryDecorator.wrap(new CreatePurchaseOrder(poRepository));
      
      const po = await useCase.execute((request.body as any));
      reply.status(201).send({
        id: po.id,
        purchaseOrderNumber: po.purchaseOrderNumber,
        status: po.status,
        vendorId: po.vendorId,
        tenantId: po.tenantId,
        locationId: po.locationId,
        items: po.items.map(i => ({
          id: i.id,
          variantId: i.variantId,
          quantity: i.quantity,
          receivedQuantity: i.receivedQuantity,
          unitCostCents: i.unitCostCents
        }))
      });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "PurchaseOrderController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "PurchaseOrderController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async approve(request: any, reply: any) {
    try {
      const poRepository = (request.server as any)["purchaseOrderRepository"] as IPurchaseOrderRepository;
      const po = await poRepository.findById((request.params as any).id);
      if (!po) {
        return reply.status(404).send({ error: "Purchase order not found" });
      }
      po.approve();
      await poRepository.save(po);
      reply.status(200).send({ message: "Purchase order approved successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "PurchaseOrderController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "PurchaseOrderController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async send(request: any, reply: any) {
    try {
      const poRepository = (request.server as any)["purchaseOrderRepository"] as IPurchaseOrderRepository;
      const po = await poRepository.findById((request.params as any).id);
      if (!po) {
        return reply.status(404).send({ error: "Purchase order not found" });
      }
      po.send();
      await poRepository.save(po);
      reply.status(200).send({ message: "Purchase order sent to vendor successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "PurchaseOrderController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "PurchaseOrderController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async receive(request: any, reply: any) {
    try {
      const poRepository = (request.server as any)["purchaseOrderRepository"] as IPurchaseOrderRepository;
      const inventoryRepository = (request.server as any)["inventoryRepository"] as IInventoryRepository;
      const costLayerRepository = (request.server as any)["costLayerRepository"] as ICostLayerRepository;
      
      const useCase = AutoRetryDecorator.wrap(new ReceivePurchaseOrder(poRepository, inventoryRepository, costLayerRepository));
      
      await useCase.execute({
        purchaseOrderId: (request.params as any).id,
        items: (request.body as any).items
      });
      reply.status(200).send({ message: "Items received successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "PurchaseOrderController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "PurchaseOrderController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async get(request: any, reply: any) {
    try {
      const poRepository = (request.server as any)["purchaseOrderRepository"] as IPurchaseOrderRepository;
      const po = await poRepository.findById((request.params as any).id);
      if (!po) {
        return reply.status(404).send({ error: "Purchase order not found" });
      }
      reply.status(200).send({
        id: po.id,
        purchaseOrderNumber: po.purchaseOrderNumber,
        status: po.status,
        vendorId: po.vendorId,
        tenantId: po.tenantId,
        locationId: po.locationId,
        items: po.items.map(i => ({
          id: i.id,
          variantId: i.variantId,
          quantity: i.quantity,
          receivedQuantity: i.receivedQuantity,
          unitCostCents: i.unitCostCents
        }))
      });
    } catch (error: any) {
      Logger.error({ context: "PurchaseOrderController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }
}
