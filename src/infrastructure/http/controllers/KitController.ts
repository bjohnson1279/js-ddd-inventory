import { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../../database/prisma";
import { Kit } from "../../../domain/kit/aggregates/Kit";
import { SKU } from "../../../domain/valueObjects/SKU";
import { InventoryService } from "../../../domain/services/InventoryService";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { DomainException } from "../../../domain/exceptions/DomainException";

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
      console.error(error);
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
        res.status(400).json({ error: error instanceof DomainException ? error.message : "Insufficient stock" });
      } else {
        console.error(error);
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
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
