import { DomainException } from "../../../domain/exceptions/DomainException";
import { Request, Response } from "express";
import { WarehouseLocation } from "../../../domain/product/entities/WarehouseLocation";
import { LocationId } from "../../../domain/valueObjects/LocationId";
import { SKU } from "../../../domain/valueObjects/SKU";
import { PutawaySuggester } from "../../../domain/services/PutawaySuggester";
import { PickingRouteOptimizer } from "../../../domain/services/PickingRouteOptimizer";
import { prisma } from "../../database/prisma";
import { Logger } from "../../../infrastructure/logging/logger";

export class WarehouseLocationController {
  static async save(req: Request, res: Response) {
    try {
      const { path, warehouseId, zone, aisle, rack, shelf, bin, maxWeightGrams, maxVolumeCubicMeters, gridX, gridY, width, height } = req.body;
      const repo = req.app.get("warehouseLocationRepository");

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

      res.status(200).json({
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
      res.status(400).json({ error: "Failed to save location." });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const repo = req.app.get("warehouseLocationRepository");
      const locations = await repo.findAll();

      res.status(200).json(
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
      res.status(500).json({ error: "Failed to list locations." });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const repo = req.app.get("warehouseLocationRepository");

      await repo.delete(new LocationId(id));

      res.status(200).json({ message: "Warehouse location deleted successfully." });
    } catch (error: any) {
      Logger.error({ context: "WarehouseLocationController", message: "An error occurred", error: error });
      Logger.error({ context: "WarehouseLocationController", message: error instanceof DomainException ? error.message : error });
      res.status(400).json({ error: "Failed to delete location." });
    }
  }

  static async suggestPutaway(req: Request, res: Response) {
    try {
      const { sku, quantity } = req.body;
      if (!sku || quantity === undefined) {
        return res.status(400).json({ error: "SKU and quantity are required." });
      }

      const inventoryRepo = req.app.get("inventoryRepository");
      const productRepo = req.app.get("productRepository");
      const locationRepo = req.app.get("warehouseLocationRepository");

      const suggester = new PutawaySuggester(inventoryRepo, productRepo, locationRepo);
      const suggestions = await suggester.suggestPutaway(SKU.create(sku), Number(quantity));

      res.status(200).json(suggestions);
    } catch (error: any) {
      Logger.error({ context: "WarehouseLocationController", message: "An error occurred", error: error });
      Logger.error({ context: "WarehouseLocationController", message: error instanceof DomainException ? error.message : error });
      res.status(400).json({ error: "Failed to generate putaway suggestions." });
    }
  }

  static async optimizePickRoute(req: Request, res: Response) {
    try {
      const { items, skus } = req.body;
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
        return res.status(400).json({ error: "Items array or SKUs array is required." });
      }

      const locationRepo = req.app.get("warehouseLocationRepository");
      const optimizer = new PickingRouteOptimizer(locationRepo);

      const optimized = await optimizer.optimizeRoute(pickItems);

      res.status(200).json(optimized);
    } catch (error: any) {
      Logger.error({ context: "WarehouseLocationController", message: "An error occurred", error: error });
      Logger.error({ context: "WarehouseLocationController", message: error instanceof DomainException ? error.message : error });
      res.status(400).json({ error: "Failed to optimize picking route." });
    }
  }

  static async suggestSlotting(req: Request, res: Response) {
    try {
      const { SlottingOptimizer } = await import("../../../domain/services/SlottingOptimizer");
      const optimizer = new SlottingOptimizer(prisma);
      const suggestions = await optimizer.generateSuggestions();
      res.status(200).json(suggestions);
    } catch (error: any) {
      Logger.error({ context: "WarehouseLocationController", message: "An error occurred", error: error });
      res.status(400).json({ error: "Failed to generate slotting suggestions." });
    }
  }
}
