import { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { IBarcodeRepository } from "../../../domain/repositories/IBarcodeRepository";
import { BarcodeRegistry } from "../../../domain/barcode/services/BarcodeRegistry";
import { InternalBarcodeGenerator } from "../../../domain/barcode/services/InternalBarcodeGenerator";
import {
  BarcodeScanDispatcher,
  ScanContext,
} from "../../../domain/barcode/services/BarcodeScanDispatcher";
import { Barcode } from "../../../domain/barcode/valueObjects/Barcode";
import { BarcodeSymbology } from "../../../domain/barcode/enums/BarcodeSymbology";
import { BarcodeSource } from "../../../domain/barcode/enums/BarcodeSource";
import { DomainException } from "../../../domain/exceptions/DomainException";

export class BarcodeController {
  static async assign(req: Request, res: Response) {
    try {
      const barcodeRepo = req.app.get(
        "barcodeRepository",
      ) as IBarcodeRepository;
      const { variantId, symbology, barcodeValue, source, isPrimary } =
        req.body;

      if (!variantId || !symbology || !barcodeValue || !source) {
        return res
          .status(400)
          .json({ error: "Missing required assignment fields." });
      }

      const set = await barcodeRepo.findSetForVariant(variantId);
      const barcode = new Barcode(symbology as BarcodeSymbology, barcodeValue);

      set.assign(barcode, source as BarcodeSource, isPrimary || false);
      await barcodeRepo.saveSet(set);

      res
        .status(200)
        .json({
          message: "Barcode assigned successfully.",
          variantId,
          barcodeValue,
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

  static async generate(req: Request, res: Response) {
    try {
      const barcodeRepo = req.app.get(
        "barcodeRepository",
      ) as IBarcodeRepository;
      const { variantId, tenantId } = req.body;

      if (!variantId) {
        return res.status(400).json({ error: "Missing variantId parameter." });
      }

      const registry = new BarcodeRegistry(barcodeRepo);
      const generator = new InternalBarcodeGenerator(registry);
      const barcode = await generator.generate(
        variantId,
        tenantId || "DEFAULT",
      );

      res.status(200).json({ barcodeValue: barcode.value });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async scan(req: Request, res: Response) {
    try {
      const barcodeRepo = req.app.get(
        "barcodeRepository",
      ) as IBarcodeRepository;
      const { rawScan, context, payload } = req.body;

      if (!rawScan || !context) {
        return res
          .status(400)
          .json({ error: "Missing rawScan or scan context." });
      }

      const registry = new BarcodeRegistry(barcodeRepo);

      // If we just want to resolve the variantId
      const variantId = await registry.resolve(rawScan);

      // We also attempt to run dispatcher routing
      // The dispatcher is intentionally instantiated and dispatched here
      // to route scans to appropriate workflow handlers if registered.
      const dispatcher = new BarcodeScanDispatcher(registry);

      let handled = false;
      try {
        await dispatcher.dispatch(rawScan, context as ScanContext, payload || {});
        handled = true;
      } catch (err: any) {
        // If no explicit handler is registered for this context, that's okay, we swallow the error
        // to maintain backward compatibility with the previously mock-registered "handled" flow.
        if (typeof err.message !== "string" || !err.message.includes("No handler registered")) {
          throw err;
        }
      }

      res.status(200).json({
        message: "Scan processed.",
        variantId,
        context,
        dispatched: handled,
      });
    } catch (error: any) {
      if (
        error instanceof DomainException ||
        (typeof error?.message === "string" && error.message.includes("not registered"))
      ) {
        res.status(404).json({ error: error.message });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const records = await prisma.barcodeAssignmentModel.findMany();
      res.status(200).json(records);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
