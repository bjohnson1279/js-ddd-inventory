import { IShipmentRepository } from "../../domain/repositories/IShipmentRepository";
import { ShipmentStatus } from "../../domain/shipping/enums/ShipmentStatus";
import { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";

export interface UpdateShipmentStatusCommand {
  shipmentId: string;
  status: ShipmentStatus;
}

export class UpdateShipmentStatus {
  constructor(
    private readonly shipmentRepository: IShipmentRepository,
    private readonly outboxRepository: IOutboxRepository
  ) {}

  async execute(command: UpdateShipmentStatusCommand): Promise<void> {
    const { shipmentId, status } = command;
    
    const shipment = await this.shipmentRepository.findById(shipmentId);
    if (!shipment) {
      throw new Error(`Shipment with ID ${shipmentId} not found.`);
    }

    shipment.updateStatus(status);
    await this.shipmentRepository.save(shipment);

    // Write status update outbox event
    await this.outboxRepository.save({
      occurredOn: new Date(),
      eventName: "ShipmentStatusUpdatedEvent",
      shipmentId,
      trackingNumber: shipment.trackingNumber,
      status
    });
  }
}
