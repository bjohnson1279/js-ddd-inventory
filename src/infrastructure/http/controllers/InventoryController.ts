import { Request, Response } from "express";
import { ReceiveStock } from "../../../application/useCases/ReceiveStock";
import { DispatchStock } from "../../../application/useCases/DispatchStock";
import { GetStockLevel } from "../../../application/useCases/GetStockLevel";
import { PerformFullStoreCount } from "../../../application/useCases/PerformFullStoreCount";
import { InMemoryInventoryRepository } from "../../database/InMemoryInventoryRepository";

const repository = new InMemoryInventoryRepository();

const receiveStock = new ReceiveStock(repository);
const dispatchStock = new DispatchStock(repository);
const getStockLevel = new GetStockLevel(repository);
const performFullStoreCount = new PerformFullStoreCount(repository);

export class InventoryController {
  static async receive(req: Request, res: Response) {
    try {
      const { sku, amount } = req.body;
      await receiveStock.execute(sku, amount);
      res.status(200).json({ message: "Stock received successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async dispatch(req: Request, res: Response) {
    try {
      const { sku, amount } = req.body;
      await dispatchStock.execute(sku, amount);
      res.status(200).json({ message: "Stock dispatched successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getLevel(req: Request, res: Response) {
    try {
      const { sku } = req.params;
      const quantity = await getStockLevel.execute(sku);
      res.status(200).json({ sku, quantity });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async performCount(req: Request, res: Response) {
    try {
      const counts = req.body.counts;
      if (!Array.isArray(counts)) {
        return res.status(400).json({ error: "Expected 'counts' to be an array" });
      }
      await performFullStoreCount.execute(counts);
      res.status(200).json({ message: "Store count performed successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
