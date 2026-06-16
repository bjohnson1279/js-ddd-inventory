import { Request, Response } from "express";
import { WarehouseLocation } from "../../../domain/product/entities/WarehouseLocation";
import { LocationId } from "../../../domain/valueObjects/LocationId";
import { SKU } from "../../../domain/valueObjects/SKU";
import { PutawaySuggester } from "../../../domain/services/PutawaySuggester";
import { PickingRouteOptimizer } from "../../../domain/services/PickingRouteOptimizer";

export class WarehouseLocationController {
  static async save(req: Request, res: Response) {
    try {
      const { path, warehouseId, zone, aisle, rack, shelf, bin, maxWeightGrams, maxVolumeCubicMeters } = req.body;
      const repo = req.app.get("warehouseLocationRepository");

      let location: WarehouseLocation;
      if (path) {
        location = WarehouseLocation.parsePath(path, maxWeightGrams, maxVolumeCubicMeters);
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
          maxVolumeCubicMeters
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
          maxVolumeCubicMeters: location.maxVolumeCubicMeters
        }
      });
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message || "Failed to save location." });
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
          maxVolumeCubicMeters: loc.maxVolumeCubicMeters
        }))
      );
    } catch (error: any) {
      console.error(error);
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
      console.error(error);
      res.status(400).json({ error: error.message || "Failed to delete location." });
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
      console.error(error);
      res.status(400).json({ error: error.message || "Failed to generate putaway suggestions." });
    }
  }

  static async optimizePickRoute(req: Request, res: Response) {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Items array is required." });
      }

      const locationRepo = req.app.get("warehouseLocationRepository");
      const optimizer = new PickingRouteOptimizer(locationRepo);

      const optimized = await optimizer.optimizeRoute(items);

      res.status(200).json(optimized);
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message || "Failed to optimize picking route." });
    }
  }
}
