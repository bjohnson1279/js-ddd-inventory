jest.mock("../../../src/infrastructure/database/prisma", () => ({
  prisma: {
    shipmentModel: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { PrismaShipmentRepository } from "../../../src/infrastructure/database/PrismaShipmentRepository";
import { Shipment } from "../../../src/domain/shipping/aggregates/Shipment";
import { ShipmentStatus } from "../../../src/domain/shipping/enums/ShipmentStatus";
import { prisma } from "../../../src/infrastructure/database/prisma";

describe("PrismaShipmentRepository", () => {
  let repository: PrismaShipmentRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PrismaShipmentRepository();
  });

  describe("save", () => {
    it("should upsert a shipment in the database with all fields mapped correctly", async () => {
      const createdAt = new Date("2024-01-01T00:00:00.000Z");
      const updatedAt = new Date("2024-01-02T00:00:00.000Z");
      const shipment = new Shipment(
        "shipment-101",
        "SKU-WIDGET-01",
        15,
        "100 Innovation Way, Tech City, CA",
        "FedEx",
        "TRACK-FEDEX-999",
        "https://shipping.example.com/labels/shipment-101.pdf",
        2500,
        ShipmentStatus.LABEL_GENERATED,
        createdAt,
        updatedAt
      );

      (prisma.shipmentModel.upsert as jest.Mock).mockResolvedValueOnce({
        id: "shipment-101",
        sku: "SKU-WIDGET-01",
        quantity: 15,
        destinationAddress: "100 Innovation Way, Tech City, CA",
        carrier: "FedEx",
        trackingNumber: "TRACK-FEDEX-999",
        labelUrl: "https://shipping.example.com/labels/shipment-101.pdf",
        shippingRateCents: 2500,
        status: ShipmentStatus.LABEL_GENERATED,
        createdAt,
        updatedAt,
      });

      await repository.save(shipment);

      expect(prisma.shipmentModel.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.shipmentModel.upsert).toHaveBeenCalledWith({
        where: { id: "shipment-101" },
        update: {
          trackingNumber: "TRACK-FEDEX-999",
          labelUrl: "https://shipping.example.com/labels/shipment-101.pdf",
          status: ShipmentStatus.LABEL_GENERATED,
        },
        create: {
          id: "shipment-101",
          sku: "SKU-WIDGET-01",
          quantity: 15,
          destinationAddress: "100 Innovation Way, Tech City, CA",
          carrier: "FedEx",
          trackingNumber: "TRACK-FEDEX-999",
          labelUrl: "https://shipping.example.com/labels/shipment-101.pdf",
          shippingRateCents: 2500,
          status: ShipmentStatus.LABEL_GENERATED,
        },
      });
    });

    it("should fallback to empty string id in where clause if shipment id is empty", async () => {
      const shipment = new Shipment(
        "",
        "SKU-EMPTY-ID",
        2,
        "456 Market St, Suite 200, SF, CA",
        "UPS",
        null,
        null,
        1200,
        ShipmentStatus.LABEL_GENERATED,
        new Date(),
        new Date()
      );

      (prisma.shipmentModel.upsert as jest.Mock).mockResolvedValueOnce({});

      await repository.save(shipment);

      expect(prisma.shipmentModel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "" },
          create: expect.objectContaining({
            id: "",
            sku: "SKU-EMPTY-ID",
            quantity: 2,
            destinationAddress: "456 Market St, Suite 200, SF, CA",
            carrier: "UPS",
            trackingNumber: null,
            labelUrl: null,
            shippingRateCents: 1200,
            status: ShipmentStatus.LABEL_GENERATED,
          }),
        })
      );
    });
  });

  describe("findById", () => {
    it("should return null when no record is found", async () => {
      (prisma.shipmentModel.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const result = await repository.findById("non-existent-id");

      expect(prisma.shipmentModel.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.shipmentModel.findUnique).toHaveBeenCalledWith({
        where: { id: "non-existent-id" },
      });
      expect(result).toBeNull();
    });

    it("should return a mapped Shipment aggregate when record is found", async () => {
      const createdAt = new Date("2024-03-01T10:00:00.000Z");
      const updatedAt = new Date("2024-03-02T15:30:00.000Z");

      (prisma.shipmentModel.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "shipment-202",
        sku: "SKU-GADGET-99",
        quantity: 3,
        destinationAddress: "789 Pine Rd, Austin, TX",
        carrier: "DHL",
        trackingNumber: "DHL-TRACK-456",
        labelUrl: "https://labels.example.com/dhl-456.png",
        shippingRateCents: 1850,
        status: "in_transit",
        createdAt,
        updatedAt,
      });

      const result = await repository.findById("shipment-202");

      expect(prisma.shipmentModel.findUnique).toHaveBeenCalledWith({
        where: { id: "shipment-202" },
      });
      expect(result).toBeInstanceOf(Shipment);
      expect(result?.id).toBe("shipment-202");
      expect(result?.sku).toBe("SKU-GADGET-99");
      expect(result?.quantity).toBe(3);
      expect(result?.destinationAddress).toBe("789 Pine Rd, Austin, TX");
      expect(result?.carrier).toBe("DHL");
      expect(result?.trackingNumber).toBe("DHL-TRACK-456");
      expect(result?.labelUrl).toBe("https://labels.example.com/dhl-456.png");
      expect(result?.shippingRateCents).toBe(1850);
      expect(result?.status).toBe(ShipmentStatus.IN_TRANSIT);
      expect(result?.createdAt).toEqual(createdAt);
      expect(result?.updatedAt).toEqual(updatedAt);
    });
  });

  describe("findAll", () => {
    it("should return an empty array if no records exist", async () => {
      (prisma.shipmentModel.findMany as jest.Mock).mockResolvedValueOnce([]);

      const results = await repository.findAll();

      expect(prisma.shipmentModel.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.shipmentModel.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
      });
      expect(results).toEqual([]);
    });

    it("should return mapped Shipment aggregate instances ordered by createdAt desc", async () => {
      const date1 = new Date("2024-03-05T12:00:00.000Z");
      const date2 = new Date("2024-03-04T12:00:00.000Z");

      (prisma.shipmentModel.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "ship-01",
          sku: "SKU-A",
          quantity: 10,
          destinationAddress: "Address 1",
          carrier: "USPS",
          trackingNumber: "USPS-1",
          labelUrl: "http://label1",
          shippingRateCents: 800,
          status: "delivered",
          createdAt: date1,
          updatedAt: date1,
        },
        {
          id: "ship-02",
          sku: "SKU-B",
          quantity: 2,
          destinationAddress: "Address 2",
          carrier: "UPS",
          trackingNumber: null,
          labelUrl: null,
          shippingRateCents: 1500,
          status: "in_transit",
          createdAt: date2,
          updatedAt: date2,
        },
      ]);

      const results = await repository.findAll();

      expect(prisma.shipmentModel.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
      });
      expect(results).toHaveLength(2);

      expect(results[0]).toBeInstanceOf(Shipment);
      expect(results[0].id).toBe("ship-01");
      expect(results[0].sku).toBe("SKU-A");
      expect(results[0].quantity).toBe(10);
      expect(results[0].destinationAddress).toBe("Address 1");
      expect(results[0].carrier).toBe("USPS");
      expect(results[0].trackingNumber).toBe("USPS-1");
      expect(results[0].labelUrl).toBe("http://label1");
      expect(results[0].shippingRateCents).toBe(800);
      expect(results[0].status).toBe(ShipmentStatus.DELIVERED);
      expect(results[0].createdAt).toEqual(date1);
      expect(results[0].updatedAt).toEqual(date1);

      expect(results[1]).toBeInstanceOf(Shipment);
      expect(results[1].id).toBe("ship-02");
      expect(results[1].sku).toBe("SKU-B");
      expect(results[1].quantity).toBe(2);
      expect(results[1].destinationAddress).toBe("Address 2");
      expect(results[1].carrier).toBe("UPS");
      expect(results[1].trackingNumber).toBeNull();
      expect(results[1].labelUrl).toBeNull();
      expect(results[1].shippingRateCents).toBe(1500);
      expect(results[1].status).toBe(ShipmentStatus.IN_TRANSIT);
      expect(results[1].createdAt).toEqual(date2);
      expect(results[1].updatedAt).toEqual(date2);
    });
  });
});
