import { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { ISerializedItemRepository } from "../../../domain/repositories/ISerializedItemRepository";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { SerializedInventoryService } from "../../../domain/serial/services/SerializedInventoryService";
import { SerialNumber } from "../../../domain/serial/valueObjects/SerialNumber";
import { DomainException } from "../../../domain/exceptions/DomainException";

export class SerialController {
  private static getService(req: Request): SerializedInventoryService {
    const serials = req.app.get(
      "serializedItemRepository",
    ) as ISerializedItemRepository;
    const inventory = req.app.get(
      "inventoryRepository",
    ) as IInventoryRepository;
    return new SerializedInventoryService(serials, inventory);
  }

  static async register(req: Request, res: Response) {
    try {
      const service = SerialController.getService(req);
      const { serialNumber, variantId, tenantId, locationId, actorId } =
        req.body;

      if (!serialNumber || !variantId || !locationId || !actorId) {
        return res.status(400).json({ error: "Missing registration fields." });
      }

      const serial = new SerialNumber(serialNumber);
      const item = await service.register(
        serial,
        variantId,
        tenantId || "DEFAULT",
        locationId,
        actorId,
      );

      res
        .status(201)
        .json({
          message: "Serial number registered.",
          id: item.id,
          serialNumber: item.serialNumber.value,
        });
    } catch (error: any) {
      if (error instanceof DomainException) {
        res.status(400).json({ error: error.message, type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async receive(req: Request, res: Response) {
    try {
      const service = SerialController.getService(req);
      const { serialNumber, tenantId, locationId, purchaseOrderId, actorId } =
        req.body;

      if (!serialNumber || !locationId || !purchaseOrderId || !actorId) {
        return res.status(400).json({ error: "Missing receipt parameters." });
      }

      const serial = new SerialNumber(serialNumber);
      await service.receive(
        serial,
        tenantId || "DEFAULT",
        locationId,
        purchaseOrderId,
        actorId,
      );

      res
        .status(200)
        .json({ message: "Serial number received and stock incremented." });
    } catch (error: any) {
      if (
        error instanceof DomainException ||
        error.message.includes("not found")
      ) {
        res.status(400).json({ error: error.message });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async sell(req: Request, res: Response) {
    try {
      const service = SerialController.getService(req);
      const { serialNumber, tenantId, saleId, actorId } = req.body;

      if (!serialNumber || !saleId || !actorId) {
        return res.status(400).json({ error: "Missing sales parameters." });
      }

      const serial = new SerialNumber(serialNumber);
      await service.sell(serial, tenantId || "DEFAULT", saleId, actorId);

      res
        .status(200)
        .json({ message: "Serial number sold and stock decremented." });
    } catch (error: any) {
      if (
        error instanceof DomainException ||
        error.message.includes("not found")
      ) {
        res.status(400).json({ error: error.message });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async acceptReturn(req: Request, res: Response) {
    try {
      const service = SerialController.getService(req);
      const { serialNumber, tenantId, returnId, actorId } = req.body;

      if (!serialNumber || !returnId || !actorId) {
        return res.status(400).json({ error: "Missing return parameters." });
      }

      const serial = new SerialNumber(serialNumber);
      await service.acceptReturn(
        serial,
        tenantId || "DEFAULT",
        returnId,
        actorId,
      );

      res.status(200).json({ message: "Serial return accepted." });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async restock(req: Request, res: Response) {
    try {
      const service = SerialController.getService(req);
      const { serialNumber, tenantId, returnId, actorId } = req.body;

      if (!serialNumber || !returnId || !actorId) {
        return res.status(400).json({ error: "Missing restock parameters." });
      }

      const serial = new SerialNumber(serialNumber);
      await service.restock(serial, tenantId || "DEFAULT", returnId, actorId);

      res
        .status(200)
        .json({ message: "Serial number restocked and stock incremented." });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async getHistory(req: Request, res: Response) {
    try {
      const serials = req.app.get(
        "serializedItemRepository",
      ) as ISerializedItemRepository;
      const { serialNumber } = req.params;
      const tenantId = (req.query.tenantId as string) || "DEFAULT";

      if (!serialNumber) {
        return res
          .status(400)
          .json({ error: "Missing serial number parameter." });
      }

      const serial = new SerialNumber(serialNumber);
      const item = await serials.findBySerial(serial, tenantId);

      if (!item) {
        return res
          .status(404)
          .json({ error: `Serial number ${serialNumber} not registered.` });
      }

      res.status(200).json({
        id: item.id,
        serialNumber: item.serialNumber.value,
        variantId: item.variantId,
        status: item.status,
        locationId: item.locationId,
        history: item.history.map((t) => ({
          from: t.from,
          to: t.to,
          reason: t.reason,
          actor: t.actor,
          referenceId: t.referenceId,
          occurredAt: t.occurredAt,
        })),
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const records = await prisma.serializedItemModel.findMany({
        include: { transitions: true },
      });
      res.status(200).json(
        records.map((item) => ({
          id: item.id,
          serialNumber: item.serialNumber,
          sku: item.sku,
          status: item.status,
          locationId: item.locationId,
          tenantId: item.tenantId,
          registeredAt: item.registeredAt,
          history: item.transitions.map((t) => ({
            from: t.fromStatus,
            to: t.toStatus,
            reason: t.reason,
            actor: t.actorId,
            referenceId: t.referenceId,
            occurredAt: t.transitionedAt,
          })),
        })),
      );
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
