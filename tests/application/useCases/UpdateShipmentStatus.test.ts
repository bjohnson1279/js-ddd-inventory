import { UpdateShipmentStatus, UpdateShipmentStatusCommand } from "../../../src/application/useCases/UpdateShipmentStatus";
import { IShipmentRepository } from "../../../src/domain/repositories/IShipmentRepository";
import { IOutboxRepository } from "../../../src/domain/repositories/IOutboxRepository";
import { Shipment } from "../../../src/domain/shipping/aggregates/Shipment";
import { ShipmentStatus } from "../../../src/domain/shipping/enums/ShipmentStatus";

describe("UpdateShipmentStatus Use Case", () => {
  let mockShipmentRepository: jest.Mocked<IShipmentRepository>;
  let mockOutboxRepository: jest.Mocked<IOutboxRepository>;
  let useCase: UpdateShipmentStatus;

  beforeEach(() => {
    mockShipmentRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
    };

    mockOutboxRepository = {
      save: jest.fn(),
      fetchPending: jest.fn(),
      markProcessed: jest.fn(),
      markFailed: jest.fn(),
      fetchDeadLettered: jest.fn(),
      retryEvent: jest.fn(),
      fetchStats: jest.fn(),
    };

    useCase = new UpdateShipmentStatus(mockShipmentRepository, mockOutboxRepository);
    jest.useFakeTimers().setSystemTime(new Date("2023-01-01T00:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should successfully update shipment status and save an outbox event", async () => {
    const shipment = new Shipment(
      "shipment-123",
      "SKU-1",
      5,
      "123 Main St",
      "UPS",
      "TRACK123",
      "http://label",
      1000,
      ShipmentStatus.LABEL_GENERATED,
      new Date(),
      new Date()
    );

    mockShipmentRepository.findById.mockResolvedValue(shipment);

    const command: UpdateShipmentStatusCommand = {
      shipmentId: "shipment-123",
      status: ShipmentStatus.IN_TRANSIT,
    };

    await useCase.execute(command);

    expect(mockShipmentRepository.findById).toHaveBeenCalledWith("shipment-123");
    expect(shipment.status).toBe(ShipmentStatus.IN_TRANSIT);
    expect(mockShipmentRepository.save).toHaveBeenCalledWith(shipment);
    expect(mockOutboxRepository.save).toHaveBeenCalledWith({
      occurredOn: new Date("2023-01-01T00:00:00Z"),
      eventName: "ShipmentStatusUpdatedEvent",
      shipmentId: "shipment-123",
      trackingNumber: "TRACK123",
      status: ShipmentStatus.IN_TRANSIT,
    });
  });

  it("should throw an error if the shipment is not found", async () => {
    mockShipmentRepository.findById.mockResolvedValue(null);

    const command: UpdateShipmentStatusCommand = {
      shipmentId: "missing-shipment",
      status: ShipmentStatus.IN_TRANSIT,
    };

    await expect(useCase.execute(command)).rejects.toThrow("Shipment with ID missing-shipment not found.");

    expect(mockShipmentRepository.findById).toHaveBeenCalledWith("missing-shipment");
    expect(mockShipmentRepository.save).not.toHaveBeenCalled();
    expect(mockOutboxRepository.save).not.toHaveBeenCalled();
  });

  it("should throw an error if trying to update status from a terminal state", async () => {
    const shipment = new Shipment(
      "shipment-123",
      "SKU-1",
      5,
      "123 Main St",
      "UPS",
      "TRACK123",
      "http://label",
      1000,
      ShipmentStatus.DELIVERED, // Terminal state
      new Date(),
      new Date()
    );

    mockShipmentRepository.findById.mockResolvedValue(shipment);

    const command: UpdateShipmentStatusCommand = {
      shipmentId: "shipment-123",
      status: ShipmentStatus.IN_TRANSIT,
    };

    await expect(useCase.execute(command)).rejects.toThrow("Cannot transition status from terminal state: delivered");

    expect(mockShipmentRepository.findById).toHaveBeenCalledWith("shipment-123");
    expect(mockShipmentRepository.save).not.toHaveBeenCalled();
    expect(mockOutboxRepository.save).not.toHaveBeenCalled();
  });

  it("should correctly handle null tracking number in outbox event", async () => {
    const shipment = new Shipment(
      "shipment-123",
      "SKU-1",
      5,
      "123 Main St",
      "UPS",
      null, // null tracking number
      "http://label",
      1000,
      ShipmentStatus.LABEL_GENERATED,
      new Date(),
      new Date()
    );

    mockShipmentRepository.findById.mockResolvedValue(shipment);

    const command: UpdateShipmentStatusCommand = {
      shipmentId: "shipment-123",
      status: ShipmentStatus.IN_TRANSIT,
    };

    await useCase.execute(command);

    expect(mockOutboxRepository.save).toHaveBeenCalledWith({
      occurredOn: new Date("2023-01-01T00:00:00Z"),
      eventName: "ShipmentStatusUpdatedEvent",
      shipmentId: "shipment-123",
      trackingNumber: null,
      status: ShipmentStatus.IN_TRANSIT,
    });
  });

  it("should propagate error if shipmentRepository.save fails", async () => {
    const shipment = new Shipment(
      "shipment-123",
      "SKU-1",
      5,
      "123 Main St",
      "UPS",
      "TRACK123",
      "http://label",
      1000,
      ShipmentStatus.LABEL_GENERATED,
      new Date(),
      new Date()
    );

    mockShipmentRepository.findById.mockResolvedValue(shipment);
    mockShipmentRepository.save.mockRejectedValue(new Error("Database failure"));

    const command: UpdateShipmentStatusCommand = {
      shipmentId: "shipment-123",
      status: ShipmentStatus.IN_TRANSIT,
    };

    await expect(useCase.execute(command)).rejects.toThrow("Database failure");
    expect(mockOutboxRepository.save).not.toHaveBeenCalled();
  });

  it("should propagate error if outboxRepository.save fails", async () => {
    const shipment = new Shipment(
      "shipment-123",
      "SKU-1",
      5,
      "123 Main St",
      "UPS",
      "TRACK123",
      "http://label",
      1000,
      ShipmentStatus.LABEL_GENERATED,
      new Date(),
      new Date()
    );

    mockShipmentRepository.findById.mockResolvedValue(shipment);
    mockOutboxRepository.save.mockRejectedValue(new Error("Outbox failure"));

    const command: UpdateShipmentStatusCommand = {
      shipmentId: "shipment-123",
      status: ShipmentStatus.IN_TRANSIT,
    };

    await expect(useCase.execute(command)).rejects.toThrow("Outbox failure");
    expect(mockShipmentRepository.save).toHaveBeenCalled();
  });
});
