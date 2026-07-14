import { Request, Response } from "express";
import { CreatePurchaseOrder } from "../../../application/useCases/CreatePurchaseOrder";
import { ReceivePurchaseOrder } from "../../../application/useCases/ReceivePurchaseOrder";
import { IPurchaseOrderRepository } from "../../../domain/repositories/IPurchaseOrderRepository";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../../domain/repositories/ICostLayerRepository";
import { DomainException } from "../../../domain/exceptions/DomainException";
import { AutoRetryDecorator } from "../../../application/decorators/AutoRetryDecorator";

export class PurchaseOrderController {
  static async create(req: Request, res: Response) {
    try {
      const poRepository = req.app.get("purchaseOrderRepository") as IPurchaseOrderRepository;
      const useCase = AutoRetryDecorator.wrap(new CreatePurchaseOrder(poRepository));
      
      const po = await useCase.execute(req.body);
      res.status(201).json({
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
        console.error(error);
        res.status(400).json({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async approve(req: Request, res: Response) {
    try {
      const poRepository = req.app.get("purchaseOrderRepository") as IPurchaseOrderRepository;
      const po = await poRepository.findById(req.params.id);
      if (!po) {
        return res.status(404).json({ error: "Purchase order not found" });
      }
      po.approve();
      await poRepository.save(po);
      res.status(200).json({ message: "Purchase order approved successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        console.error(error);
        res.status(400).json({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async send(req: Request, res: Response) {
    try {
      const poRepository = req.app.get("purchaseOrderRepository") as IPurchaseOrderRepository;
      const po = await poRepository.findById(req.params.id);
      if (!po) {
        return res.status(404).json({ error: "Purchase order not found" });
      }
      po.send();
      await poRepository.save(po);
      res.status(200).json({ message: "Purchase order sent to vendor successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        console.error(error);
        res.status(400).json({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async receive(req: Request, res: Response) {
    try {
      const poRepository = req.app.get("purchaseOrderRepository") as IPurchaseOrderRepository;
      const inventoryRepository = req.app.get("inventoryRepository") as IInventoryRepository;
      const costLayerRepository = req.app.get("costLayerRepository") as ICostLayerRepository;
      
      const useCase = AutoRetryDecorator.wrap(new ReceivePurchaseOrder(poRepository, inventoryRepository, costLayerRepository));
      
      await useCase.execute({
        purchaseOrderId: req.params.id,
        items: req.body.items
      });
      res.status(200).json({ message: "Items received successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        console.error(error);
        res.status(400).json({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async get(req: Request, res: Response) {
    try {
      const poRepository = req.app.get("purchaseOrderRepository") as IPurchaseOrderRepository;
      const po = await poRepository.findById(req.params.id);
      if (!po) {
        return res.status(404).json({ error: "Purchase order not found" });
      }
      res.status(200).json({
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
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
