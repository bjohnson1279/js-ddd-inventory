import { DomainException } from "../../../domain/exceptions/DomainException";
import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { WarehouseLocation } from "../../../domain/product/entities/WarehouseLocation";
import { LocationId } from "../../../domain/valueObjects/LocationId";
import { SKU } from "../../../domain/valueObjects/SKU";
import { PutawaySuggester } from "../../../domain/services/PutawaySuggester";
import { PickingRouteOptimizer } from "../../../domain/services/PickingRouteOptimizer";
import { prisma } from "../../database/prisma";
import { Logger } from "../../../infrastructure/logging/logger";

export class WarehouseLocationController {
  static async save(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { path, warehouseId, zone, aisle, rack, shelf, bin, maxWeightGrams, maxVolumeCubicMeters, gridX, gridY, width, height } = request.body;
      const repo = request.server["warehouseLocationRepository"];

      let location: WarehouseLocation;
      if (path) {
        // Parse grid details if available, otherwise fallback
        const parsed = WarehouseLocation.parsePath(path, maxWeightGrams, maxVolumeCubicMeters);
        location = new WarehouseLocation(
          parsed.id,
          parsed.warehouseId,
          parsed.zone,
          parsed.aisle,
          parsed.rack,
          parsed.shelf,
          parsed.bin,
          parsed.maxWeightGrams,
          parsed.maxVolumeCubicMeters,
          gridX !== undefined ? Number(gridX) : 0,
          gridY !== undefined ? Number(gridY) : 0,
          width !== undefined ? Number(width) : 1,
          height !== undefined ? Number(height) : 1
        );
      } else {
        const idStr = `${warehouseId}-${zone}-${aisle}-${rack}-${shelf}-${bin}`;
        location = new WarehouseLocation(
          new LocationId(idStr),
          warehouseId,
          zone,
          aisle,
          rack,
          shelf,
          bin,
          maxWeightGrams,
          maxVolumeCubicMeters,
          gridX !== undefined ? Number(gridX) : 0,
          gridY !== undefined ? Number(gridY) : 0,
          width !== undefined ? Number(width) : 1,
          height !== undefined ? Number(height) : 1
        );
      }

      await repo.save(location);

      reply.status(200).send({
        message: "Warehouse location saved successfully.",
        location: {
          id: location.id.value,
          warehouseId: location.warehouseId,
          zone: location.zone,
          aisle: location.aisle,
          rack: location.rack,
          shelf: location.shelf,
          bin: location.bin,
          maxWeightGrams: location.maxWeightGrams,
          maxVolumeCubicMeters: location.maxVolumeCubicMeters,
          gridX: location.gridX,
          gridY: location.gridY,
          width: location.width,
          height: location.height
        }
      });
    } catch (error: any) {
      Logger.error({ context: "WarehouseLocationController", message: "An error occurred", error: error });
      reply.status(400).send({ error: "Failed to save location." });
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const repo = request.server["warehouseLocationRepository"];
      const locations = await repo.findAll();

      reply.status(200).send(
        locations.map((loc: WarehouseLocation) => ({
          id: loc.id.value,
          warehouseId: loc.warehouseId,
          zone: loc.zone,
          aisle: loc.aisle,
          rack: loc.rack,
          shelf: loc.shelf,
          bin: loc.bin,
          maxWeightGrams: loc.maxWeightGrams,
          maxVolumeCubicMeters: loc.maxVolumeCubicMeters,
          gridX: loc.gridX,
          gridY: loc.gridY,
          width: loc.width,
          height: loc.height
        }))
      );
    } catch (error: any) {
      Logger.error({ context: "WarehouseLocationController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Failed to list locations." });
    }
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params;
      const repo = request.server["warehouseLocationRepository"];

      await repo.delete(new LocationId(id));

      reply.status(200).send({ message: "Warehouse location deleted successfully." });
    } catch (error: any) {
      Logger.error({ context: "WarehouseLocationController", message: "An error occurred", error: error });
      Logger.error({ context: "WarehouseLocationController", message: error instanceof DomainException ? error.message : error });
      reply.status(400).send({ error: "Failed to delete location." });
    }
  }

  static async suggestPutaway(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { sku, quantity } = request.body;
      if (!sku || quantity === undefined) {
        return reply.status(400).send({ error: "SKU and quantity are required." });
      }

      const inventoryRepo = request.server["inventoryRepository"];
      const productRepo = request.server["productRepository"];
      const locationRepo = request.server["warehouseLocationRepository"];

      const suggester = new PutawaySuggester(inventoryRepo, productRepo, locationRepo);
      const suggestions = await suggester.suggestPutaway(SKU.create(sku), Number(quantity));

      reply.status(200).send(suggestions);
    } catch (error: any) {
      Logger.error({ context: "WarehouseLocationController", message: "An error occurred", error: error });
      Logger.error({ context: "WarehouseLocationController", message: error instanceof DomainException ? error.message : error });
      reply.status(400).send({ error: "Failed to generate putaway suggestions." });
    }
  }

  static async optimizePickRoute(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { items, skus } = request.body;
      let pickItems = items;

      if (!pickItems && Array.isArray(skus)) {
        const records = await prisma.inventoryModel.findMany({
          where: { sku: { in: skus } }
        });
        const foundSkus = new Set(records.map(r => r.sku));
        pickItems = records.map(r => ({
          sku: r.sku,
          quantity: 1,
          locationId: r.locationId
        }));
        // Fallback for SKUs with no inventory record
        for (const sku of skus) {
          if (!foundSkus.has(sku)) {
            const firstLoc = await prisma.warehouseLocationModel.findFirst();
            pickItems.push({
              sku,
              quantity: 1,
              locationId: firstLoc ? firstLoc.id : "default"
            });
          }
        }
      }

      if (!Array.isArray(pickItems)) {
        return reply.status(400).send({ error: "Items array or SKUs array is required." });
      }

      const locationRepo = request.server["warehouseLocationRepository"];
      const optimizer = new PickingRouteOptimizer(locationRepo);

      const optimized = await optimizer.optimizeRoute(pickItems);

      reply.status(200).send(optimized);
    } catch (error: any) {
      Logger.error({ context: "WarehouseLocationController", message: "An error occurred", error: error });
      Logger.error({ context: "WarehouseLocationController", message: error instanceof DomainException ? error.message : error });
      reply.status(400).send({ error: "Failed to optimize picking route." });
    }
  }

  static async suggestSlotting(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { SlottingOptimizer } = await import("../../../domain/services/SlottingOptimizer");
      const optimizer = new SlottingOptimizer(prisma);
      const suggestions = await optimizer.generateSuggestions();
      reply.status(200).send(suggestions);
    } catch (error: any) {
      Logger.error({ context: "WarehouseLocationController", message: "An error occurred", error: error });
      reply.status(400).send({ error: "Failed to generate slotting suggestions." });
    }
  }
}
