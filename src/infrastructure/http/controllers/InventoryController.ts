import { Request, Response } from "express";
import { ReceiveStock } from "../../../application/useCases/ReceiveStock";
import { DispatchStock } from "../../../application/useCases/DispatchStock";
import { GetStockLevel } from "../../../application/useCases/GetStockLevel";
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

export class InventoryController {
  static async receive(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const { sku, amount, locationId, unitCostCents, lotNumber, expirationDate, tenantId, purchaseOrderId } = req.body;
      const capacityService = req.app.get("wmsCapacityService");
      const productRepository = req.app.get("productRepository");
      const costLayerRepository = req.app.get("costLayerRepository");
      const receiveStock = new ReceiveStock(repository, undefined, capacityService, productRepository, costLayerRepository);
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
      const { sku, amount, locationId, lotNumber } = req.body;
      const reorderPolicyService = req.app.get("reorderPolicyService");
      const dispatchRecordRepository = req.app.get("dispatchRecordRepository");
      const productRepository = req.app.get("productRepository");
      const costLayerRepository = req.app.get("costLayerRepository");
      const dispatchStock = new DispatchStock(
        repository,
        undefined,
        reorderPolicyService,
        dispatchRecordRepository,
        productRepository,
        costLayerRepository
      );
      await dispatchStock.execute(sku, amount, locationId, false, lotNumber);
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
      const locationId = (req.query.locationId as string) || "default";

      const skuObj = SKU.create(sku);
      const item = await repository.findBySku(skuObj, locationId);

      const responseBody: any = {
        sku,
        quantity: item ? item.quantity.getValue() : 0,
        allocated: item ? item.allocated.getValue() : 0,
        inTransit: item ? item.inTransit.getValue() : 0,
        available: item ? item.available.getValue() : 0,
      };

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
          allocated: item.allocated.getValue(),
          inTransit: item.inTransit.getValue(),
          available: item.available.getValue(),
        })),
      );
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async allocate(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const { sku, amount, locationId } = req.body;
      const useCase = new AllocateStock(repository);
      await useCase.execute(sku, amount, locationId);
      res.status(200).json({ message: "Stock allocated successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        res.status(400).json({ error: error.message, type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async releaseAllocation(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const { sku, amount, locationId } = req.body;
      const useCase = new ReleaseAllocation(repository);
      await useCase.execute(sku, amount, locationId);
      res.status(200).json({ message: "Allocation released successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        res.status(400).json({ error: error.message, type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async fulfillAllocation(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const { sku, amount, locationId } = req.body;
      const useCase = new FulfillAllocation(repository);
      await useCase.execute(sku, amount, locationId);
      res.status(200).json({ message: "Allocation fulfilled successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        res.status(400).json({ error: error.message, type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async createInTransit(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const { sku, amount, locationId } = req.body;
      const useCase = new CreateInTransit(repository);
      await useCase.execute(sku, amount, locationId);
      res.status(200).json({ message: "In-transit stock created successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        res.status(400).json({ error: error.message, type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async receiveInTransit(req: Request, res: Response) {
    try {
      const repository = req.app.get("repository") as IInventoryRepository;
      const { sku, amount, locationId } = req.body;
      const useCase = new ReceiveInTransit(repository);
      await useCase.execute(sku, amount, locationId);
      res.status(200).json({ message: "In-transit stock received successfully" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        res.status(400).json({ error: error.message, type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async suggestFefoPick(req: Request, res: Response) {
    try {
      const productRepository = req.app.get("productRepository");
      const costLayerRepository = req.app.get("costLayerRepository");
      const { sku, quantity } = req.query;

      if (!sku || !quantity) {
        return res.status(400).json({ error: "SKU and quantity are required query parameters" });
      }

      const useCase = new SuggestFefoPicking(productRepository, costLayerRepository);
      const suggestions = await useCase.execute(sku as string, parseInt(quantity as string, 10));

      res.status(200).json(suggestions);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }

  static async traceRecall(req: Request, res: Response) {
    try {
      const dispatchRecordRepository = req.app.get("dispatchRecordRepository");
      const { lotNumber } = req.params;

      if (!lotNumber) {
        return res.status(400).json({ error: "Lot number is required" });
      }

      const useCase = new TraceProductRecall(dispatchRecordRepository);
      const dispatches = await useCase.execute(lotNumber);

      res.status(200).json(dispatches);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
}
