import { IRfidTagRepository } from "../../domain/repositories/IRfidTagRepository";
import { ISerializedItemRepository } from "../../domain/repositories/ISerializedItemRepository";
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";
import amqp from "amqplib";
import { Logger } from "../logging/logger";
import { tenantLocalStorage } from "../database/tenantContext";
import { RfidScanProcessedEvent } from "../../domain/events/RfidScanProcessedEvent";
import { DomainEventDispatcher } from "../../domain/events/DomainEventDispatcher";
import { SerialNumber } from "../../domain/serial/valueObjects/SerialNumber";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
export class RfidBulkScanWorker {
  private amqpConnection: amqp.ChannelModel | null = null;
  private amqpChannel: amqp.Channel | null = null;

  constructor(
    private readonly amqpUrl: string,
    private readonly rfidTagRepo: IRfidTagRepository,
    private readonly serializedItemRepo: ISerializedItemRepository,
    private readonly inventoryRepo: IInventoryRepository,
    private readonly outboxRepo: IOutboxRepository
  ) {}

  public async start(): Promise<void> {
    try {
      this.amqpConnection = await amqp.connect(this.amqpUrl);
      this.amqpChannel = await this.amqpConnection.createChannel();
      await this.amqpChannel.assertQueue("rfid_bulk_scans", { durable: true });
      await this.amqpChannel.prefetch(1);

      Logger.info({
        context: "RfidBulkScanWorker",
        message: `[RfidBulkScanWorker] Started and listening to AMQP queue "rfid_bulk_scans"`,
      });

      this.amqpChannel.consume("rfid_bulk_scans", async (msg) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(msg.content.toString());
          await this.processScanBatch(payload);
          this.amqpChannel?.ack(msg);
        } catch (err: any) {
          Logger.error({
            context: "RfidBulkScanWorker",
            message: "Failed to process scan batch, dead-lettering message:",
            error: err.message || err,
          });
          this.amqpChannel?.nack(msg, false, false);
        }
      });
    } catch (err: any) {
      Logger.error({
        context: "RfidBulkScanWorker",
        message: "Failed to start RfidBulkScanWorker:",
        error: err.message,
      });
      throw err;
    }
  }

  private async processScanBatch(payload: any): Promise<void> {
    const { tenantId, locationId, tags } = payload;

    if (!tenantId || !locationId || !Array.isArray(tags)) {
      throw new Error("Invalid batch payload received by worker.");
    }

    await tenantLocalStorage.run(tenantId, async () => {
      Logger.info({
        context: "RfidBulkScanWorker",
        message: `[RfidBulkScanWorker] Processing bulk scan of ${tags.length} tags at location "${locationId}" for tenant "${tenantId}"`,
      });

      const epcs = tags.map((t: any) => t.epc);
      const registeredTags = await this.rfidTagRepo.findByEpcs(tenantId, epcs);

      const matchedEpcs = new Set(registeredTags.map((t) => t.epc));
      const unmatchedEpcs: string[] = [];

      let matchedCount = 0;
      let unmatchedCount = 0;

      for (const tag of tags) {
        if (matchedEpcs.has(tag.epc.toUpperCase())) {
          matchedCount++;
        } else {
          unmatchedCount++;
          unmatchedEpcs.push(tag.epc);
        }
      }

      for (const regTag of registeredTags) {
        const updatedTag = Object.assign(
          Object.create(Object.getPrototypeOf(regTag)),
          regTag,
          {
            lastSeenAt: new Date(),
            lastLocation: locationId,
            status: "ACTIVE",
          }
        );
        await this.rfidTagRepo.save(tenantId, updatedTag);

        const serialNo = new SerialNumber(regTag.serialNumber.value);
        const serialItem = await this.serializedItemRepo.findBySerial(serialNo, tenantId);

        if (serialItem) {
          const oldLoc = serialItem.locationId;
          if (oldLoc !== locationId) {
            serialItem.scanCheckIn(locationId, "rfid-scan-worker");
            await this.serializedItemRepo.save(serialItem);

            if (oldLoc && oldLoc !== "default") {
              const oldInv = await this.inventoryRepo.findBySku(
                SKU.create(regTag.sku),
                oldLoc
              );
              if (oldInv) {
                oldInv.dispatchStock(Quantity.create(1));
                await this.inventoryRepo.save(oldInv);
              }
            }

            let newInv = await this.inventoryRepo.findBySku(
              SKU.create(regTag.sku),
              locationId
            );
            if (!newInv) {
              newInv = InventoryItem.create(
                Date.now().toString(),
                SKU.create(regTag.sku),
                locationId,
                Quantity.create(0)
              );
            }
            newInv.receiveStock(Quantity.create(1));
            await this.inventoryRepo.save(newInv);

            Logger.info({
              context: "RfidBulkScanWorker",
              message: `[RfidBulkScanWorker] Successfully relocated serial number "${regTag.serialNumber.value}" (SKU: ${regTag.sku}) from "${oldLoc}" to "${locationId}"`,
            });
          }
        }
      }

      const scanEvent = new RfidScanProcessedEvent(
        `scan-batch-${Date.now()}`,
        tenantId,
        locationId,
        tags.length,
        matchedCount,
        unmatchedCount,
        unmatchedEpcs
      );

      await this.outboxRepo.save(scanEvent);
      await DomainEventDispatcher.dispatch([scanEvent]);

      Logger.info({
        context: "RfidBulkScanWorker",
        message: `[RfidBulkScanWorker] Completed scan processing. Matched: ${matchedCount}, Unmatched: ${unmatchedCount}`,
      });
    });
  }

  public async stop(): Promise<void> {
    if (this.amqpChannel) {
      await this.amqpChannel.close();
      this.amqpChannel = null;
    }
    if (this.amqpConnection) {
      await this.amqpConnection.close();
      this.amqpConnection = null;
    }
    Logger.info({
      context: "RfidBulkScanWorker",
      message: "Stopped RfidBulkScanWorker",
    });
  }
}
