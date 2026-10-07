import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { ReceiveStock } from "../../../application/useCases/ReceiveStock";
import { DispatchStock } from "../../../application/useCases/DispatchStock";
import { PerformFullStoreCount } from "../../../application/useCases/PerformFullStoreCount";
import { AllocateStock } from "../../../application/useCases/AllocateStock";
import { ReleaseAllocation } from "../../../application/useCases/ReleaseAllocation";
import { FulfillAllocation } from "../../../application/useCases/FulfillAllocation";
import { CreateInTransit } from "../../../application/useCases/CreateInTransit";
import { ReceiveInTransit } from "../../../application/useCases/ReceiveInTransit";
import { SuggestFefoPicking } from "../../../application/useCases/SuggestFefoPicking";
import { TraceProductRecall } from "../../../application/useCases/TraceProductRecall";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { DomainException } from "../../../domain/exceptions/DomainException";
import { SKU } from "../../../domain/valueObjects/SKU";
import { AutoRetryDecorator } from "../../../application/decorators/AutoRetryDecorator";
import { Logger } from "../../../infrastructure/logging/logger";

export class InventoryController {
  static async receive(request: FastifyRequest, reply: FastifyReply) {
    try {
      const repository = request.server["repository"] as IInventoryRepository;
      const { sku, amount, locationId, unitCostCents, lotNumber, expirationDate, tenantId, purchaseOrderId } = request.body;
      if (!sku || typeof sku !== 'string' || sku.trim() === '') {
        return reply.status(400).send({ error: "Invalid or missing sku" });
      }
      if (amount == null || typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
        return reply.status(400).send({ error: "Invalid or missing amount" });
      }
      if (locationId && typeof locationId !== 'string') {
        return reply.status(400).send({ error: "Invalid locationId" });
      }
      const capacityService = request.server["wmsCapacityService"];
      const productRepository = request.server["productRepository"];
      const costLayerRepository = request.server["costLayerRepository"];
      const receiveStock = AutoRetryDecorator.wrap(new ReceiveStock(repository, undefined, capacityService, productRepository, costLayerRepository));
      await receiveStock.execute(
        sku,
        amount,
        locationId,
        unitCostCents,
        lotNumber,
        expirationDate ? new Date(expirationDate) : undefined,
        tenantId,
        purchaseOrderId
      );
      reply.status(200).send({ message: "Stock received successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async dispatch(request: FastifyRequest, reply: FastifyReply) {
    try {
      const repository = request.server["repository"] as IInventoryRepository;
      const { sku, amount, locationId, lotNumber } = request.body;
      if (!sku || typeof sku !== 'string' || sku.trim() === '') {
        return reply.status(400).send({ error: "Invalid or missing sku" });
      }
      if (amount == null || typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
        return reply.status(400).send({ error: "Invalid or missing amount" });
      }
      if (locationId && typeof locationId !== 'string') {
        return reply.status(400).send({ error: "Invalid locationId" });
      }
      const reorderPolicyService = request.server["reorderPolicyService"];
      const dispatchRecordRepository = request.server["dispatchRecordRepository"];
      const productRepository = request.server["productRepository"];
      const costLayerRepository = request.server["costLayerRepository"];
      const dispatchStock = AutoRetryDecorator.wrap(new DispatchStock(
        repository,
        undefined,
        reorderPolicyService,
        dispatchRecordRepository,
        productRepository,
        costLayerRepository
      ));
      await dispatchStock.execute(sku, amount, locationId, false, lotNumber);
      reply.status(200).send({ message: "Stock dispatched successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async getLevel(request: FastifyRequest, reply: FastifyReply) {
    try {
      const repository = request.server["repository"] as IInventoryRepository;
      const { sku } = request.params;
      if (request.query.locationId !== undefined && typeof request.query.locationId !== "string") {
        return reply.status(400).send({ error: "Invalid locationId parameter" });
      }
      const locationId = request.query.locationId ? (request.query.locationId as string).trim() : "default";

      const skuObj = SKU.create(sku);
      const item = await repository.findBySku(skuObj, locationId);

      const responseBody: any = {
        sku,
        quantity: item ? item.quantity.getValue() : 0,
        allocated: item ? item.allocated.getValue() : 0,
        inTransit: item ? item.inTransit.getValue() : 0,
        available: item ? item.available.getValue() : 0,
      };

      if (request.query.locationId) {
        responseBody.locationId = locationId;
      }
      reply.status(200).send(responseBody);
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async performCount(request: FastifyRequest, reply: FastifyReply) {
    try {
      const repository = request.server["repository"] as IInventoryRepository;
      const { counts, locationId } = request.body;
      if (!Array.isArray(counts)) {
        return reply.status(400).send({ error: "Expected 'counts' to be an array" });
      }

      // Validate counts array items
      for (const count of counts) {
        if (!count.sku || typeof count.sku !== 'string' || count.sku.trim() === '') {
          return reply.status(400).send({ error: "Invalid sku in counts array" });
        }
        if (count.count == null || typeof count.count !== 'number' || count.count < 0 || !Number.isInteger(count.count)) {
          return reply.status(400).send({ error: "Invalid quantity in counts array" });
        }
      }
      if (locationId && typeof locationId !== 'string') {
        return reply.status(400).send({ error: "Invalid locationId" });
      }

      const performFullStoreCount = AutoRetryDecorator.wrap(new PerformFullStoreCount(repository));
      await performFullStoreCount.execute(counts, locationId);
      reply.status(200).send({ message: "Store count performed successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const repository = request.server["repository"] as IInventoryRepository;
      const items = await repository.findAll();
      reply.status(200).send(
        items.map((item) => ({
          id: item.id,
          sku: item.sku.getValue(),
          quantity: item.quantity.getValue(),
          allocated: item.allocated.getValue(),
          inTransit: item.inTransit.getValue(),
          available: item.available.getValue(),
        })),
      );
    } catch (error: any) {
      Logger.error({ context: "InventoryController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async allocate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const repository = request.server["repository"] as IInventoryRepository;
      const { sku, amount, locationId } = request.body;
      const useCase = AutoRetryDecorator.wrap(new AllocateStock(repository));
      await useCase.execute(sku, amount, locationId);
      reply.status(200).send({ message: "Stock allocated successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async releaseAllocation(request: FastifyRequest, reply: FastifyReply) {
    try {
      const repository = request.server["repository"] as IInventoryRepository;
      const { sku, amount, locationId } = request.body;
      const useCase = AutoRetryDecorator.wrap(new ReleaseAllocation(repository));
      await useCase.execute(sku, amount, locationId);
      reply.status(200).send({ message: "Allocation released successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async fulfillAllocation(request: FastifyRequest, reply: FastifyReply) {
    try {
      const repository = request.server["repository"] as IInventoryRepository;
      const { sku, amount, locationId } = request.body;
      const useCase = AutoRetryDecorator.wrap(new FulfillAllocation(repository));
      await useCase.execute(sku, amount, locationId);
      reply.status(200).send({ message: "Allocation fulfilled successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async createInTransit(request: FastifyRequest, reply: FastifyReply) {
    try {
      const repository = request.server["repository"] as IInventoryRepository;
      const { sku, amount, locationId } = request.body;
      const useCase = AutoRetryDecorator.wrap(new CreateInTransit(repository));
      await useCase.execute(sku, amount, locationId);
      reply.status(200).send({ message: "In-transit stock created successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async receiveInTransit(request: FastifyRequest, reply: FastifyReply) {
    try {
      const repository = request.server["repository"] as IInventoryRepository;
      const { sku, amount, locationId } = request.body;
      const useCase = AutoRetryDecorator.wrap(new ReceiveInTransit(repository));
      await useCase.execute(sku, amount, locationId);
      reply.status(200).send({ message: "In-transit stock received successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async suggestFefoPick(request: FastifyRequest, reply: FastifyReply) {
    try {
      const productRepository = request.server["productRepository"];
      const costLayerRepository = request.server["costLayerRepository"];
      const { sku, quantity } = request.query;

      if (!sku || !quantity) {
        return reply.status(400).send({ error: "SKU and quantity are required query parameters" });
      }

      if (typeof sku !== "string" || typeof quantity !== "string") {
        return reply.status(400).send({ error: "Invalid query parameters" });
      }

      const parsedQuantity = parseInt(quantity.trim(), 10);
      if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
        return reply.status(400).send({ error: "Invalid quantity parameter" });
      }

      const useCase = new SuggestFefoPicking(productRepository, costLayerRepository);
      const suggestions = await useCase.execute(sku.trim(), parsedQuantity);

      reply.status(200).send(suggestions);
    } catch (error: any) {
      const isDomainOrExpectedError = error instanceof DomainException ||
        (error.message && (
          error.message.includes("No lot-controlled inventory layers") ||
          error.message.includes("Product variant with SKU") ||
          error.message.includes("Insufficient lot-controlled inventory")
        ));

      if (isDomainOrExpectedError) {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name || "Error" });
      } else {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async traceRecall(request: FastifyRequest, reply: FastifyReply) {
    try {
      const dispatchRecordRepository = request.server["dispatchRecordRepository"];
      const { lotNumber } = request.params;

      if (!lotNumber) {
        return reply.status(400).send({ error: "Lot number is required" });
      }

      const useCase = new TraceProductRecall(dispatchRecordRepository);
      const dispatches = await useCase.execute(lotNumber);

      reply.status(200).send(dispatches);
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "InventoryController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }
}
