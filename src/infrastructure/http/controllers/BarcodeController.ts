import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
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
import { WebSocketManager } from "../../websocket/WebSocketManager";
import { Logger } from "../../../infrastructure/logging/logger";


export class BarcodeController {
  static async assign(request: any, reply: any) {
    try {
      const barcodeRepo = (request.server as any).barcodeRepository as IBarcodeRepository;
      const { variantId, symbology, barcodeValue, source, isPrimary } =
        (request.body as any);

      if (!variantId || !symbology || !barcodeValue || !source) {
        return reply
          .status(400)
          .send({ error: "Missing required assignment fields." });
      }

      const set = await barcodeRepo.findSetForVariant(variantId);
      const barcode = new Barcode(symbology as BarcodeSymbology, barcodeValue);

      set.assign(barcode, source as BarcodeSource, isPrimary || false);
      await barcodeRepo.saveSet(set);

      reply
        .status(200)
        .send({
          message: "Barcode assigned successfully.",
          variantId,
          barcodeValue,
        });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "BarcodeController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "BarcodeController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async generate(request: any, reply: any) {
    try {
      const barcodeRepo = (request.server as any).barcodeRepository as IBarcodeRepository;
      const { variantId, tenantId } = (request.body as any);

      if (!variantId) {
        return reply.status(400).send({ error: "Missing variantId parameter." });
      }

      const registry = new BarcodeRegistry(barcodeRepo);
      const generator = new InternalBarcodeGenerator(registry);
      const barcode = await generator.generate(
        variantId,
        tenantId || "DEFAULT",
      );

      reply.status(200).send({ barcodeValue: barcode.value });
    } catch (error: any) {
      Logger.error({ context: "BarcodeController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async scan(request: any, reply: any) {
    try {
      const barcodeRepo = (request.server as any).barcodeRepository as IBarcodeRepository;
      const { rawScan, context, payload } = (request.body as any);

      if (!rawScan || !context) {
        return reply
          .status(400)
          .send({ error: "Missing rawScan or scan context." });
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

      // Broadcast via WebSocket to the tenant
      const tenantId = (request as any).tenantId || "tenant-1";
      WebSocketManager.broadcastToTenant(tenantId, {
        type: "barcode_scanned",
        rawScan,
        scanValue: rawScan,
        context,
        variantId,
        status: "success",
        payload: payload || {},
        time: new Date().toISOString()
      });

      reply.status(200).send({
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
        Logger.error({ context: "BarcodeController", message: error instanceof DomainException ? error.message : error });
        reply.status(404).send({ error: "Not registered" });
      } else {
        Logger.error({ context: "BarcodeController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async list(request: any, reply: any) {
    try {
      const records = await prisma.barcodeAssignmentModel.findMany();
      reply.status(200).send(records);
    } catch (error: any) {
      Logger.error({ context: "BarcodeController", message: "An error occurred", error: error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }
}
