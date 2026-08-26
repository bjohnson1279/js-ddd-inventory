import { IShipmentRepository } from "../../domain/repositories/IShipmentRepository";
import { Shipment } from "../../domain/shipping/aggregates/Shipment";
import { ShipmentStatus } from "../../domain/shipping/enums/ShipmentStatus";
import { prisma } from "./prisma";

export class PrismaShipmentRepository implements IShipmentRepository {
  private prisma = prisma;

  async save(shipment: Shipment): Promise<void> {
    // If the shipment ID is empty, prisma upsert will fail to match a unique condition, 
    // so we handle custom ID generation/matching if needed, but since id is generated on creation, we can use it.
    await this.prisma.shipmentModel.upsert({
      where: { id: shipment.id || "" },
      update: {
        trackingNumber: shipment.trackingNumber,
        labelUrl: shipment.labelUrl,
        status: shipment.status
      },
      create: {
        id: shipment.id,
        sku: shipment.sku,
        quantity: shipment.quantity,
        destinationAddress: shipment.destinationAddress,
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        labelUrl: shipment.labelUrl,
        shippingRateCents: shipment.shippingRateCents,
        status: shipment.status
      }
    });
  }

  async findById(id: string): Promise<Shipment | null> {
    const s = await this.prisma.shipmentModel.findUnique({
      where: { id }
    });
    if (!s) return null;
    return new Shipment(
      s.id,
      s.sku,
      s.quantity,
      s.destinationAddress,
      s.carrier,
      s.trackingNumber,
      s.labelUrl,
      s.shippingRateCents,
      s.status as ShipmentStatus,
      s.createdAt,
      s.updatedAt
    );
  }

  async findAll(): Promise<Shipment[]> {
    const records = await this.prisma.shipmentModel.findMany({
      orderBy: { createdAt: "desc" }
    });
    return records.map((s: any) => new Shipment(
      s.id,
      s.sku,
      s.quantity,
      s.destinationAddress,
      s.carrier,
      s.trackingNumber,
      s.labelUrl,
      s.shippingRateCents,
      s.status as ShipmentStatus,
      s.createdAt,
      s.updatedAt
    ));
  }
}
