import { IShipmentRepository } from "../../domain/repositories/IShipmentRepository";
import { Shipment } from "../../domain/shipping/aggregates/Shipment";

export class InMemoryShipmentRepository implements IShipmentRepository {
  private shipments: Map<string, Shipment> = new Map();

  async save(shipment: Shipment): Promise<void> {
    this.shipments.set(shipment.id, shipment);
  }

  async findById(id: string): Promise<Shipment | null> {
    return this.shipments.get(id) || null;
  }

  async findAll(): Promise<Shipment[]> {
    return Array.from(this.shipments.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
