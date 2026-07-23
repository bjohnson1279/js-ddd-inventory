import amqp from "amqplib";
import mqtt from "mqtt";
import { MqttIngestService } from "../../../src/infrastructure/iot/MqttIngestService";
import { RfidBulkScanWorker } from "../../../src/infrastructure/iot/RfidBulkScanWorker";
import { InMemoryRfidTagRepository } from "../../../src/infrastructure/database/InMemoryRfidTagRepository";
import { InMemorySerializedItemRepository } from "../../../src/infrastructure/database/InMemorySerializedItemRepository";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { InMemoryOutboxRepository } from "../../../src/infrastructure/database/InMemoryOutboxRepository";
import { RfidTag } from "../../../src/domain/rfid/valueObjects/RfidTag";
import { SerializedItem } from "../../../src/domain/serial/aggregates/SerializedItem";
import { SerialNumber } from "../../../src/domain/serial/valueObjects/SerialNumber";
import { SerializedItemStatus } from "../../../src/domain/serial/enums/SerializedItemStatus";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";

jest.mock("amqplib");
jest.mock("mqtt");

describe("RFID Bulk Ingestion and Processing Worker", () => {
  let mockAmqpConnection: any;
  let mockAmqpChannel: any;
  let mockMqttClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAmqpChannel = {
      assertQueue: jest.fn().mockResolvedValue({}),
      prefetch: jest.fn().mockResolvedValue({}),
      sendToQueue: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn().mockResolvedValue({}),
    };

    mockAmqpConnection = {
      createChannel: jest.fn().mockResolvedValue(mockAmqpChannel),
      close: jest.fn().mockResolvedValue({}),
    };

    (amqp.connect as jest.Mock).mockResolvedValue(mockAmqpConnection);

    // Mock MQTT
    mockMqttClient = {
      on: jest.fn(),
      subscribe: jest.fn(),
      end: jest.fn(),
    };

    (mqtt.connect as jest.Mock).mockReturnValue(mockMqttClient);
  });

  describe("MqttIngestService", () => {
    it("should start, subscribe to wildcard topics, and forward scan payloads to AMQP", async () => {
      const ingestService = new MqttIngestService("mqtt://localhost:1883", "amqp://localhost:5672");

      let messageCallback: any = null;

      mockMqttClient.on.mockImplementation((event: string, callback: any) => {
        if (event === "connect") {
          callback();
        } else if (event === "message") {
          messageCallback = callback;
        }
      });

      await ingestService.start();

      expect(amqp.connect).toHaveBeenCalledWith("amqp://localhost:5672");
      expect(mockAmqpChannel.assertQueue).toHaveBeenCalledWith("rfid_bulk_scans", { durable: true });
      expect(mqtt.connect).toHaveBeenCalledWith("mqtt://localhost:1883");
      expect(mockMqttClient.subscribe).toHaveBeenCalledWith("tenants/+/rfid/scans", expect.any(Function));

      const mqttPayload = {
        locationId: "WH1-ZONEA",
        tags: [
          { epc: "E28011912000789A12345678", rssi: -50 },
          { epc: "E28011912000789A12345679", rssi: -55 },
        ],
      };

      if (messageCallback) {
        await messageCallback(
          "tenants/test-tenant/rfid/scans",
          Buffer.from(JSON.stringify(mqttPayload))
        );
      }

      expect(mockAmqpChannel.sendToQueue).toHaveBeenCalledWith(
        "rfid_bulk_scans",
        expect.any(Buffer),
        { persistent: true }
      );

      const sentBytes = mockAmqpChannel.sendToQueue.mock.calls[0][1];
      const parsedAmqpPayload = JSON.parse(sentBytes.toString());

      expect(parsedAmqpPayload.tenantId).toBe("test-tenant");
      expect(parsedAmqpPayload.locationId).toBe("WH1-ZONEA");
      expect(parsedAmqpPayload.tags).toHaveLength(2);
      expect(parsedAmqpPayload.tags[0].epc).toBe("E28011912000789A12345678");

      await ingestService.stop();
    });
  });

  describe("RfidBulkScanWorker", () => {
    let rfidTagRepo: InMemoryRfidTagRepository;
    let serializedItemRepo: InMemorySerializedItemRepository;
    let inventoryRepo: InMemoryInventoryRepository;
    let outboxRepo: InMemoryOutboxRepository;
    let worker: RfidBulkScanWorker;

    beforeEach(() => {
      rfidTagRepo = new InMemoryRfidTagRepository();
      serializedItemRepo = new InMemorySerializedItemRepository();
      inventoryRepo = new InMemoryInventoryRepository();
      outboxRepo = new InMemoryOutboxRepository();

      worker = new RfidBulkScanWorker(
        "amqp://localhost",
        rfidTagRepo,
        serializedItemRepo,
        inventoryRepo,
        outboxRepo
      );
    });

    it("should process scan updates: update tag seen records, relocate serial items, and adjust inventory quantities", async () => {
      const tenantId = "test-tenant";
      const locationId = "NEW-LOCATION";

      // 1. Setup pre-registered tags
      const tag1 = new RfidTag("E28011912000789A12345678", "SKU-A", "SN-A101");
      const tag2 = new RfidTag("E28011912000789A12345679", "SKU-A", "SN-A102");
      await rfidTagRepo.save(tenantId, tag1);
      await rfidTagRepo.save(tenantId, tag2);

      // 2. Setup pre-registered SerializedItems in database at OLD-LOCATION
      const item1 = new SerializedItem(
        "item-1",
        "SKU-A",
        new SerialNumber("SN-A101"),
        tenantId,
        "OLD-LOCATION",
        SerializedItemStatus.InStock
      );
      const item2 = new SerializedItem(
        "item-2",
        "SKU-A",
        new SerialNumber("SN-A102"),
        tenantId,
        "OLD-LOCATION",
        SerializedItemStatus.InStock
      );
      await serializedItemRepo.save(item1);
      await serializedItemRepo.save(item2);

      // 3. Setup old location stock
      const oldStock = InventoryItem.create("inv-old", SKU.create("SKU-A"), "OLD-LOCATION", Quantity.create(10));
      await inventoryRepo.save(oldStock);

      let workerCallback: any = null;
      mockAmqpChannel.consume.mockImplementation((queue: string, callback: any) => {
        workerCallback = callback;
      });

      await worker.start();

      const amqpMessage = {
        content: Buffer.from(
          JSON.stringify({
            tenantId,
            locationId,
            tags: [
              { epc: "E28011912000789A12345678" },
              { epc: "E28011912000789A12345679" },
              { epc: "E28011912000789A99999999" }, // Unknown tag
            ],
          })
        ),
      };

      if (workerCallback) {
        await workerCallback(amqpMessage);
      }

      const updatedTag1 = await rfidTagRepo.findByEpc(tenantId, "E28011912000789A12345678");
      expect(updatedTag1?.lastLocation).toBe("NEW-LOCATION");
      expect(updatedTag1?.lastSeenAt).toBeInstanceOf(Date);

      const updatedItem1 = await serializedItemRepo.findBySerial(new SerialNumber("SN-A101"), tenantId);
      expect(updatedItem1?.locationId).toBe("NEW-LOCATION");

      const finalOldStock = await inventoryRepo.findBySku(SKU.create("SKU-A"), "OLD-LOCATION");
      const finalNewStock = await inventoryRepo.findBySku(SKU.create("SKU-A"), "NEW-LOCATION");

      expect(finalOldStock?.quantity.getValue()).toBe(8);
      expect(finalNewStock?.quantity.getValue()).toBe(2);
      const outboxEvents = await outboxRepo.fetchPending(10, 5);
      expect(outboxEvents).toHaveLength(1);
      expect(outboxEvents[0].eventName).toBe("RfidScanProcessedEvent");

      const payload = JSON.parse(outboxEvents[0].payload);
      expect(payload.matchedCount).toBe(2);
      expect(payload.unmatchedCount).toBe(1);
      expect(payload.unmatchedEpcs).toContain("E28011912000789A99999999");

      await worker.stop();
    });
  });
});
