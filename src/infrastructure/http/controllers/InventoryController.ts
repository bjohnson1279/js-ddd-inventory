import { Request, Response } from "express";
import { ReceiveStock } from "../../../application/useCases/ReceiveStock";
import { DispatchStock } from "../../../application/useCases/DispatchStock";
import { GetStockLevel } from "../../../application/useCases/GetStockLevel";
import { PerformFullStoreCount } from "../../../application/useCases/PerformFullStoreCount";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { DomainException } from "../../../domain/exceptions/DomainException";

export class InventoryController {
  static async receive(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const { sku, amount, locationId } = req.body;
      const receiveStock = new ReceiveStock(repository);
      await receiveStock.execute(sku, amount, locationId);
      res.status(200).json({ message: "Stock received successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        res.status(400).json({ error: error.message, type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async dispatch(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const { sku, amount, locationId } = req.body;
      const reorderPolicyService = req.app.get("reorderPolicyService");
      const dispatchStock = new DispatchStock(repository, undefined, reorderPolicyService);
      await dispatchStock.execute(sku, amount, locationId);
      res.status(200).json({ message: "Stock dispatched successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        res.status(400).json({ error: error.message, type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async getLevel(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const { sku } = req.params;
      const locationId = req.query.locationId as string || "default";
      const getStockLevel = new GetStockLevel(repository);
      const quantity = await getStockLevel.execute(sku, locationId);
      
      const responseBody: any = { sku, quantity };
      if (req.query.locationId) {
        responseBody.locationId = locationId;
      }
      res.status(200).json(responseBody);
    } catch (error: any) {
      if (error instanceof DomainException) {
        res.status(400).json({ error: error.message, type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async performCount(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const { counts, locationId } = req.body;
      if (!Array.isArray(counts)) {
        return res
          .status(400)
          .json({ error: "Expected 'counts' to be an array" });
      }
      const performFullStoreCount = new PerformFullStoreCount(repository);
      await performFullStoreCount.execute(counts, locationId);
      res.status(200).json({ message: "Store count performed successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        res.status(400).json({ error: error.message, type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const items = await repository.findAll();
      res.status(200).json(
        items.map((item) => ({
          id: item.id,
          sku: item.sku.getValue(),
          quantity: item.quantity.getValue(),
        })),
      );
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
