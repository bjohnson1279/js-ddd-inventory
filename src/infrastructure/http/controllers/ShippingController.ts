import { Request, Response } from "express";
import { CalculateShippingRates } from "../../../application/useCases/CalculateShippingRates";
import { PurchaseShippingLabel } from "../../../application/useCases/PurchaseShippingLabel";
import { UpdateShipmentStatus } from "../../../application/useCases/UpdateShipmentStatus";
import { IShipmentRepository } from "../../../domain/repositories/IShipmentRepository";
import { ICarrierService } from "../../../application/ports/ICarrierService";
import { IInventoryRepository } from "../../../domain/repositories/IInventoryRepository";
import { IDispatchRecordRepository } from "../../../domain/repositories/IDispatchRecordRepository";
import { ITenantConfigRepository } from "../../../domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../../domain/repositories/IJournalRepository";
import { IOutboxRepository } from "../../../domain/repositories/IOutboxRepository";
import { ShipmentStatus } from "../../../domain/shipping/enums/ShipmentStatus";

export class ShippingController {
  static async getRates(req: Request, res: Response) {
    try {
      const carrierService = req.app.get("carrierService") as ICarrierService;
      const useCase = new CalculateShippingRates(carrierService);

      const { sku, quantity, address } = req.query;
      if (!sku || !address) {
        return res.status(400).json({ error: "Missing required query parameters: sku and address." });
      }

      const rates = await useCase.execute({
        sku: sku as string,
        quantity: quantity ? parseInt(quantity as string) : 1,
        destinationAddress: address as string
      });

      res.status(200).json(rates);
    } catch (error: any) {
      console.error("Failed to estimate shipping rates:", error);
      res.status(500).json({ error: error.message || "Failed to fetch rates." });
    }
  }

  static async purchaseLabel(req: Request, res: Response) {
    try {
      const shipmentRepository = req.app.get("shipmentRepository") as IShipmentRepository;
      const carrierService = req.app.get("carrierService") as ICarrierService;
      const inventoryRepository = req.app.get("inventoryRepository") as IInventoryRepository;
      const dispatchRecordRepository = req.app.get("dispatchRecordRepository") as IDispatchRecordRepository;
      const tenantConfigRepository = req.app.get("tenantConfigRepository") as ITenantConfigRepository;
      const journalRepository = req.app.get("journalRepository") as IJournalRepository;
      const outboxRepository = req.app.get("outboxRepository") as IOutboxRepository;

      const useCase = new PurchaseShippingLabel(
        shipmentRepository,
        carrierService,
        inventoryRepository,
        dispatchRecordRepository,
        tenantConfigRepository,
        journalRepository,
        outboxRepository
      );

      const { sku, quantity, destinationAddress, carrier, locationId, tenantId } = req.body;

      const result = await useCase.execute({
        sku,
        quantity: parseInt(quantity),
        destinationAddress,
        carrier,
        locationId: locationId || "default",
        tenantId: tenantId || "DEFAULT"
      });

      res.status(201).json({
        message: "Shipping label purchased successfully.",
        ...result
      });
    } catch (error: any) {
      console.error("Failed to purchase shipping label:", error);
      res.status(400).json({ error: error.message || "Label purchase failed." });
    }
  }

  static async getShipments(req: Request, res: Response) {
    try {
      const shipmentRepository = req.app.get("shipmentRepository") as IShipmentRepository;
      const shipments = await shipmentRepository.findAll();

      res.status(200).json(
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
      console.error("Failed to list shipments:", error);
      res.status(500).json({ error: error.message || "Failed to list shipments." });
    }
  }

  static async trackShipment(req: Request, res: Response) {
    try {
      const shipmentRepository = req.app.get("shipmentRepository") as IShipmentRepository;
      const outboxRepository = req.app.get("outboxRepository") as IOutboxRepository;
      const useCase = new UpdateShipmentStatus(shipmentRepository, outboxRepository);

      const { id } = req.params;
      const { status } = req.body;

      await useCase.execute({
        shipmentId: id,
        status: status as ShipmentStatus
      });

      res.status(200).json({ message: "Shipment status updated successfully.", status });
    } catch (error: any) {
      console.error("Failed to update tracking status:", error);
      res.status(400).json({ error: error.message || "Failed to update tracking." });
    }
  }
}
