import { Request, Response } from "express";
import { ReceiveStock } from "../../../application/useCases/ReceiveStock";
import { DispatchStock } from "../../../application/useCases/DispatchStock";
import { GetStockLevel } from "../../../application/useCases/GetStockLevel";
import { PerformFullStoreCount } from "../../../application/useCases/PerformFullStoreCount";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";

export class InventoryController {
  static async receive(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const { sku, amount } = req.body;
      const receiveStock = new ReceiveStock(repository);
      await receiveStock.execute(sku, amount);
      res.status(200).json({ message: "Stock received successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async dispatch(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const { sku, amount } = req.body;
      const dispatchStock = new DispatchStock(repository);
      await dispatchStock.execute(sku, amount);
      res.status(200).json({ message: "Stock dispatched successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getLevel(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const { sku } = req.params;
      const getStockLevel = new GetStockLevel(repository);
      const quantity = await getStockLevel.execute(sku);
      res.status(200).json({ sku, quantity });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async performCount(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const counts = req.body.counts;
      if (!Array.isArray(counts)) {
        return res.status(400).json({ error: "Expected 'counts' to be an array" });
      }
      const performFullStoreCount = new PerformFullStoreCount(repository);
      await performFullStoreCount.execute(counts);
      res.status(200).json({ message: "Store count performed successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
