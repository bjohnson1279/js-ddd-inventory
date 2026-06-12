import { DomainException } from "../../../domain/exceptions/DomainException";

import { Request, Response } from "express";
import { CreateRMA } from "../../../application/useCases/CreateRMA";
import { AuthorizeRMA } from "../../../application/useCases/AuthorizeRMA";
import { ReceiveRMA } from "../../../application/useCases/ReceiveRMA";
import { IRMARepository } from "../../../domain/repositories/IRMARepository";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../../domain/repositories/ICostLayerRepository";
import { IQuarantineRepository } from "../../../domain/repositories/IQuarantineRepository";
import { ITenantConfigRepository } from "../../../domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../../domain/repositories/IJournalRepository";
import { ISerializedItemRepository } from "../../../domain/repositories/ISerializedItemRepository";

export class RMAController {
  static async create(req: Request, res: Response) {
    try {
      const rmaRepository = req.app.get("rmaRepository") as IRMARepository;
      const useCase = new CreateRMA(rmaRepository);

      const rma = await useCase.execute(req.body);
      res.status(201).json({
        id: rma.id,
        rmaNumber: rma.rmaNumber,
        tenantId: rma.tenantId,
        customerId: rma.customerId,
        locationId: rma.locationId,
        status: rma.status,
        items: rma.items.map((i) => ({
          id: i.id,
          variantId: i.variantId,
          quantity: i.quantity,
          receivedQuantity: i.receivedQuantity,
          unitCostCents: i.unitCostCents,
          status: i.status,
          disposition: i.disposition,
        })),
      });
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error instanceof DomainException ? error.message : "Bad request" });
    }
  }

  static async authorize(req: Request, res: Response) {
    try {
      const rmaRepository = req.app.get("rmaRepository") as IRMARepository;
      const useCase = new AuthorizeRMA(rmaRepository);

      await useCase.execute(req.params.id);
      res.status(200).json({ message: "RMA authorized successfully" });
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error instanceof DomainException ? error.message : "Bad request" });
    }
  }

  static async receive(req: Request, res: Response) {
    try {
      const rmaRepository = req.app.get("rmaRepository") as IRMARepository;
      const inventoryRepository = req.app.get("inventoryRepository") as IInventoryRepository;
      const costLayerRepository = req.app.get("costLayerRepository") as ICostLayerRepository;
      const quarantineRepository = req.app.get("quarantineRepository") as IQuarantineRepository;
      const tenantConfigRepository = req.app.get("tenantConfigRepository") as ITenantConfigRepository;
      const journalRepository = req.app.get("journalRepository") as IJournalRepository;
      const serializedItemRepository = req.app.get("serializedItemRepository") as ISerializedItemRepository;

      const useCase = new ReceiveRMA(
        rmaRepository,
        inventoryRepository,
        costLayerRepository,
        quarantineRepository,
        tenantConfigRepository,
        journalRepository,
        serializedItemRepository
      );

      await useCase.execute({
        rmaId: req.params.id,
        items: req.body.items,
      });

      res.status(200).json({ message: "RMA items received and processed successfully" });
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error instanceof DomainException ? error.message : "Bad request" });
    }
  }

  static async get(req: Request, res: Response) {
    try {
      const rmaRepository = req.app.get("rmaRepository") as IRMARepository;
      const rma = await rmaRepository.findById(req.params.id);
      if (!rma) {
        return res.status(404).json({ error: "RMA not found" });
      }

      res.status(200).json({
        id: rma.id,
        rmaNumber: rma.rmaNumber,
        tenantId: rma.tenantId,
        customerId: rma.customerId,
        locationId: rma.locationId,
        status: rma.status,
        items: rma.items.map((i) => ({
          id: i.id,
          variantId: i.variantId,
          quantity: i.quantity,
          receivedQuantity: i.receivedQuantity,
          unitCostCents: i.unitCostCents,
          status: i.status,
          disposition: i.disposition,
        })),
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
