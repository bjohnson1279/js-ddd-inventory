import { Logger } from "../../logging/logger";
import { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../../database/prisma";
import { Kit } from "../../../domain/kit/aggregates/Kit";
import { SKU } from "../../../domain/valueObjects/SKU";
import { InventoryService } from "../../../domain/services/InventoryService";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { DomainException } from "../../../domain/exceptions/DomainException";
import { AssembleKit } from "../../../application/useCases/AssembleKit";
import { DisassembleKit } from "../../../application/useCases/DisassembleKit";
import { AutoRetryDecorator } from "../../../application/decorators/AutoRetryDecorator";

export class KitController {
  static async create(req: Request, res: Response) {
    try {
      const { sku, name, components } = req.body;

      if (
        !sku ||
        !name ||
        !Array.isArray(components) ||
        components.length === 0
      ) {
        return res
          .status(400)
          .json({
            error: "Missing required fields (sku, name, components array).",
          });
      }

      const id = crypto.randomUUID();

      // Save to database inside a transaction
      await prisma.$transaction(async (tx) => {
        await tx.kitModel.create({
          data: {
            id,
            sku,
            name,
            components: {
              create: components.map((c: any) => ({
                id: crypto.randomUUID(),
                variantId: c.variantId,
                quantity: c.quantity,
              })),
            },
          },
        });
      });

      res
        .status(201)
        .json({ message: "Kit formula created successfully.", kitId: id, sku });
    } catch (error: any) {
      Logger.error({ context: "KitController" }, error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async dispatchSale(req: Request, res: Response) {
    try {
      const { kitSku, quantity, saleId, actorId } = req.body;

      if (!kitSku || !quantity || !saleId || !actorId) {
        return res
          .status(400)
          .json({ error: "Missing required dispatch fields." });
      }

      // Query database for kit composition
      const kitRecord = await prisma.kitModel.findUnique({
        where: { sku: kitSku },
        include: { components: true },
      });

      if (!kitRecord) {
        return res
          .status(404)
          .json({ error: `Kit with SKU ${kitSku} not found.` });
      }

      // Reconstitute Kit aggregate
      const kit = new Kit(
        kitRecord.id,
        SKU.create(kitRecord.sku),
        kitRecord.name,
      );
      for (const comp of kitRecord.components) {
        kit.addComponent(comp.variantId, comp.quantity);
      }

      // Execute atomic sale via InventoryService
      const inventoryRepo = req.app.get(
        "inventoryRepository",
      ) as IInventoryRepository;
      const reorderPolicyService = req.app.get("reorderPolicyService");
      const service = new InventoryService(inventoryRepo, reorderPolicyService);

      await service.decrementForKitSale(kit, quantity, saleId, actorId);

      res
        .status(200)
        .json({
          message: "Kit sale dispatched successfully.",
          kitSku,
          quantity,
        });
    } catch (error: any) {
      if (
        error instanceof DomainException ||
        (typeof error?.message === "string" && error.message.includes("Insufficient"))
      ) {
        Logger.error({ context: "KitController" }, error instanceof DomainException ? error.message : error);
      res.status(400).json({ error: "Insufficient stock" });
      } else {
        Logger.error({ context: "KitController" }, error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const records = await prisma.kitModel.findMany({
        include: { components: true },
      });
      res.status(200).json(records);
    } catch (error: any) {
      Logger.error({ context: "KitController" }, error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async assemble(req: Request, res: Response) {
    try {
      const { kitSku, quantity, locationId, referenceId } = req.body;
      const tenantId = (req as any).tenantId || "tenant-1";
      const actorId = (req as any).user?.id || "system";

      if (!kitSku || !quantity || !locationId || !referenceId) {
        return res.status(400).json({ error: "Missing required fields (kitSku, quantity, locationId, referenceId)." });
      }

      const inventoryRepository = req.app.get("inventoryRepository");
      const costLayerRepository = req.app.get("costLayerRepository");
      const tenantConfigRepository = req.app.get("tenantConfigRepository");
      const journalRepository = req.app.get("journalRepository");

      const useCase = AutoRetryDecorator.wrap(new AssembleKit(
        inventoryRepository,
        costLayerRepository,
        tenantConfigRepository,
        journalRepository
      ));

      await useCase.execute({
        tenantId,
        locationId,
        kitSku,
        quantity: parseInt(quantity, 10),
        actorId,
        referenceId
      });

      res.status(200).json({ message: `Successfully assembled ${quantity} units of Kit ${kitSku}.` });
    } catch (error: any) {
      Logger.error({ context: "KitController" }, error);
      res.status(400).json({ error: "Failed to assemble kit" });
    }
  }

  static async disassemble(req: Request, res: Response) {
    try {
      const { kitSku, quantity, locationId, referenceId } = req.body;
      const tenantId = (req as any).tenantId || "tenant-1";
      const actorId = (req as any).user?.id || "system";

      if (!kitSku || !quantity || !locationId || !referenceId) {
        return res.status(400).json({ error: "Missing required fields (kitSku, quantity, locationId, referenceId)." });
      }

      const inventoryRepository = req.app.get("inventoryRepository");
      const costLayerRepository = req.app.get("costLayerRepository");
      const tenantConfigRepository = req.app.get("tenantConfigRepository");
      const journalRepository = req.app.get("journalRepository");

      const useCase = AutoRetryDecorator.wrap(new DisassembleKit(
        inventoryRepository,
        costLayerRepository,
        tenantConfigRepository,
        journalRepository
      ));

      await useCase.execute({
        tenantId,
        locationId,
        kitSku,
        quantity: parseInt(quantity, 10),
        actorId,
        referenceId
      });

      res.status(200).json({ message: `Successfully disassembled ${quantity} units of Kit ${kitSku}.` });
    } catch (error: any) {
      Logger.error({ context: "KitController" }, error);
      Logger.error({ context: "KitController" }, error instanceof DomainException ? error.message : error);
      res.status(400).json({ error: "Failed to disassemble kit" });
    }
  }
}
