import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { CalculateShippingRates } from "../../../application/useCases/CalculateShippingRates";
import { PurchaseShippingLabel } from "../../../application/useCases/PurchaseShippingLabel";
import { UpdateShipmentStatus } from "../../../application/useCases/UpdateShipmentStatus";
import { RouteOrder } from "../../../application/useCases/RouteOrder";
import { MockGeocoderService } from "../../services/MockGeocoderService";
import { IShipmentRepository } from "../../../domain/repositories/IShipmentRepository";
import { ICarrierService } from "../../../application/ports/ICarrierService";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { IDispatchRecordRepository } from "../../../domain/repositories/IDispatchRecordRepository";
import { ITenantConfigRepository } from "../../../domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../../domain/repositories/IJournalRepository";
import { IOutboxRepository } from "../../../domain/repositories/IOutboxRepository";
import { ShipmentStatus } from "../../../domain/shipping/enums/ShipmentStatus";
import { DomainException } from "../../../domain/exceptions/DomainException";
import { Logger } from "../../../infrastructure/logging/logger";
import crypto from "crypto";

export class ShippingController {
  static async getRates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const carrierService = request.server["carrierService"] as ICarrierService;
      const useCase = new CalculateShippingRates(carrierService);

      const { sku, quantity, address } = request.query;

      if (!sku || !address) {
        return reply.status(400).send({ error: "Missing required parameters: sku, address." });
      }

      if (typeof sku !== "string" || typeof address !== "string" || (quantity !== undefined && typeof quantity !== "string")) {
        return reply.status(400).send({ error: "Invalid query parameters" });
      }

      const parsedQuantity = quantity ? parseInt((quantity as string).trim(), 10) : 1;
      if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
        return reply.status(400).send({ error: "Invalid quantity parameter" });
      }

      const rates = await useCase.execute({
        sku: (sku as string).trim(),
        quantity: parsedQuantity,
        destinationAddress: (address as string).trim()
      });

      reply.status(200).send(rates);
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "ShippingController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "ShippingController", message: "Failed to estimate shipping rates:", error: error });
        reply.status(500).send({ error: "Failed to fetch rates." });
      }
    }
  }

  static async purchaseLabel(request: FastifyRequest, reply: FastifyReply) {
    try {
      const shipmentRepository = request.server["shipmentRepository"] as IShipmentRepository;
      const carrierService = request.server["carrierService"] as ICarrierService;
      const inventoryRepository = request.server["inventoryRepository"] as IInventoryRepository;
      const dispatchRecordRepository = request.server["dispatchRecordRepository"] as IDispatchRecordRepository;
      const tenantConfigRepository = request.server["tenantConfigRepository"] as ITenantConfigRepository;
      const journalRepository = request.server["journalRepository"] as IJournalRepository;
      const outboxRepository = request.server["outboxRepository"] as IOutboxRepository;

      const useCase = new PurchaseShippingLabel(
        shipmentRepository,
        carrierService,
        inventoryRepository,
        dispatchRecordRepository,
        tenantConfigRepository,
        journalRepository,
        outboxRepository
      );

      const { sku, quantity, destinationAddress, carrier, locationId, tenantId } = request.body;

      const result = await useCase.execute({
        sku,
        quantity: parseInt(quantity),
        destinationAddress,
        carrier,
        locationId: locationId || "default",
        tenantId: tenantId || "DEFAULT"
      });

      reply.status(201).send({
        message: "Shipping label purchased successfully.",
        ...result
      });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "ShippingController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "ShippingController", message: "Failed to purchase shipping label:", error: error });
        reply.status(500).send({ error: "Label purchase failed." });
      }
    }
  }

  static async getShipments(request: FastifyRequest, reply: FastifyReply) {
    try {
      const shipmentRepository = request.server["shipmentRepository"] as IShipmentRepository;
      const shipments = await shipmentRepository.findAll();

      reply.status(200).send(
        shipments.map(s => ({
          id: s.id,
          sku: s.sku,
          quantity: s.quantity,
          destinationAddress: s.destinationAddress,
          carrier: s.carrier,
          trackingNumber: s.trackingNumber,
          labelUrl: s.labelUrl,
          shippingRateCents: s.shippingRateCents,
          status: s.status,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt
        }))
      );
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "ShippingController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "ShippingController", message: "Failed to list shipments:", error: error });
        reply.status(500).send({ error: "Failed to list shipments." });
      }
    }
  }

  static async trackShipment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const shipmentRepository = request.server["shipmentRepository"] as IShipmentRepository;
      const outboxRepository = request.server["outboxRepository"] as IOutboxRepository;
      const useCase = new UpdateShipmentStatus(shipmentRepository, outboxRepository);

      const { id } = request.params;
      const { status } = request.body;

      await useCase.execute({
        shipmentId: id,
        status: status as ShipmentStatus
      });

      reply.status(200).send({ message: "Shipment status updated successfully.", status });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "ShippingController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "ShippingController", message: "Failed to update tracking status:", error: error });
        reply.status(500).send({ error: "Failed to update tracking." });
      }
    }
  }

  static async routeOrder(request: FastifyRequest, reply: FastifyReply) {
    try {
      const inventoryRepository = request.server["inventoryRepository"] as IInventoryRepository;
      const carrierService = request.server["carrierService"] as ICarrierService;
      const geocoderService = request.server["geocoderService"] || new MockGeocoderService();

      const useCase = new RouteOrder(inventoryRepository, carrierService, geocoderService);

      const { sku, quantity, destinationAddress, strategyName } = request.body;

      if (!sku || !quantity || !destinationAddress) {
        return reply.status(400).send({ error: "Missing required body fields: sku, quantity, and destinationAddress." });
      }

      const plan = await useCase.execute({
        sku,
        quantity: parseInt(quantity),
        destinationAddress,
        strategyName
      });

      reply.status(200).send(plan);
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "ShippingController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while routing the order.", type: error.name });
      } else {
        Logger.error({ context: "ShippingController", message: "Failed to route order:", error: error });
        reply.status(500).send({ error: "Failed to route order." });
      }
    }
  }

  static async calculateCarrierRates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { carrier, originPostalCode, destinationPostalCode, weightKg, serviceLevel } = request.body;
      if (!carrier || !originPostalCode || !destinationPostalCode || weightKg === undefined) {
        return reply.status(400).send({ error: "Missing required fields: carrier, originPostalCode, destinationPostalCode, weightKg." });
      }

      const weight = parseFloat(weightKg);
      const baseDistanceFactor = Math.abs(
        parseInt(String(destinationPostalCode).replace(/\D/g, '') || '90001', 10) -
        parseInt(String(originPostalCode).replace(/\D/g, '') || '10001', 10)
      );

      const baseCents = Math.round(1500 + weight * 250 + (baseDistanceFactor % 2000));
      const fuelSurchargeCents = Math.round(baseCents * 0.12);
      const totalRateCents = baseCents + fuelSurchargeCents;

      let service = serviceLevel || 'GROUND_STANDARD';
      let days = 3;
      if (carrier === 'FEDEX') { service = serviceLevel || 'FEDEX_EXPRESS_SAVER'; days = 2; }
      else if (carrier === 'UPS') { service = serviceLevel || 'UPS_GROUND'; days = 3; }
      else if (carrier === 'DHL') { service = serviceLevel || 'EXPRESS_WORLDWIDE'; days = 1; }
      else if (carrier === 'GENERIC_LTL') { service = serviceLevel || 'FREIGHT_LTL_STANDARD'; days = 5; }

      reply.status(200).send({
        carrier,
        serviceLevel: service,
        baseRateCents: baseCents,
        fuelSurchargeCents,
        totalRateCents,
        estimatedDeliveryDays: days,
        currency: 'USD',
      });
    } catch (error: any) {
      Logger.error({ context: "ShippingController", message: "Failed to calculate carrier rates:", error });
      reply.status(500).send({ error: "Failed to calculate carrier rates." });
    }
  }

  static async generateShippingLabel(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { carrier, recipientName, shippingAddress, weightKg, serviceLevel, format } = request.body;
      if (!carrier || !recipientName || !shippingAddress) {
        return reply.status(400).send({ error: "Missing required fields: carrier, recipientName, shippingAddress." });
      }

      const labelFormat = format || 'BOTH';
      const trackingPrefix = carrier === 'FEDEX' ? 'FX' : carrier === 'UPS' ? '1Z' : carrier === 'DHL' ? 'DHL' : 'LTL';
      const trackingNumber = `${trackingPrefix}${crypto.randomInt(1000000000, 10000000000)}`;

      const safeRecipient = String(recipientName || '').replace(/[\^~]/g, '');
      const safeAddress = String(shippingAddress || '').replace(/[\^~]/g, '');
      const zplString = (labelFormat === 'ZPL' || labelFormat === 'BOTH')
        ? `^XA^FO50,50^A0N,50,50^FD${carrier} SHIPPING LABEL^FS^FO50,120^A0N,30,30^FDTo: ${safeRecipient}^FS^FO50,160^A0N,25,25^FDAddr: ${safeAddress}^FS^FO50,210^BY3^BCN,100,Y,N,N^FD${trackingNumber}^FS^XZ`
        : undefined;

      const pdfBase64 = (labelFormat === 'PDF' || labelFormat === 'BOTH')
        ? Buffer.from(`PDF-MOCK-LABEL-${carrier}-${trackingNumber}-${recipientName}`).toString('base64')
        : undefined;

      reply.status(200).send({
        carrier,
        trackingNumber,
        serviceLevel: serviceLevel || 'STANDARD_GROUND',
        labelFormat,
        zplString,
        pdfBase64,
        bolUrl: carrier === 'GENERIC_LTL' ? `https://logistics.internal/bol/${trackingNumber}.pdf` : undefined,
        createdAt: new Date().toISOString(),
      });
    } catch (error: any) {
      Logger.error({ context: "ShippingController", message: "Failed to generate shipping label:", error });
      reply.status(500).send({ error: "Failed to generate shipping label." });
    }
  }
}

