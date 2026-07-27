import mqtt from "mqtt";
import amqp from "amqplib";
import { Logger } from "../logging/logger";

export class MqttIngestService {
  private mqttClient: mqtt.MqttClient | null = null;
  private amqpConnection: amqp.ChannelModel | null = null;
  private amqpChannel: amqp.Channel | null = null;

  constructor(
    private readonly mqttUrl: string,
    private readonly amqpUrl: string
  ) {}

  public async start(): Promise<void> {
    try {
      // 1. Connect to RabbitMQ (AMQP)
      this.amqpConnection = await amqp.connect(this.amqpUrl);
      this.amqpChannel = await this.amqpConnection.createChannel();
      await this.amqpChannel.assertQueue("rfid_bulk_scans", { durable: true });
      Logger.info({
        context: "MqttIngestService",
        message: `[MqttIngestService] Connected to RabbitMQ at ${this.amqpUrl} and asserted queue "rfid_bulk_scans"`,
      });

      // 2. Connect to MQTT Broker
      this.mqttClient = mqtt.connect(this.mqttUrl);

      this.mqttClient.on("connect", () => {
        Logger.info({
          context: "MqttIngestService",
          message: `[MqttIngestService] Connected to MQTT Broker at ${this.mqttUrl}`,
        });
        // Subscribe to wildcard tenant topic
        this.mqttClient?.subscribe("tenants/+/rfid/scans", (err) => {
          if (err) {
            Logger.error({
              context: "MqttIngestService",
              message: "Failed to subscribe to MQTT topic",
              error: err,
            });
          } else {
            Logger.info({
              context: "MqttIngestService",
              message: "Subscribed to MQTT topic 'tenants/+/rfid/scans'",
            });
          }
        });
      });

      this.mqttClient.on("message", async (topic, message) => {
        await this.handleMqttMessage(topic, message.toString());
      });

      this.mqttClient.on("error", (err) => {
        Logger.error({
          context: "MqttIngestService",
          message: "MQTT client error:",
          error: err,
        });
      });
    } catch (err: any) {
      Logger.error({
        context: "MqttIngestService",
        message: "Failed to start MqttIngestService:",
        error: err.message,
      });
      throw err;
    }
  }

  private async handleMqttMessage(topic: string, rawPayload: string): Promise<void> {
    // Topic: tenants/{tenantId}/rfid/scans
    const match = topic.match(/^tenants\/([^/]+)\/rfid\/scans$/);
    if (!match) {
      Logger.warn({
        context: "MqttIngestService",
        message: `Ignored message on unsupported topic: ${topic}`,
      });
      return;
    }

    const tenantId = match[1];

    try {
      const data = JSON.parse(rawPayload);
      if (!data.locationId || !Array.isArray(data.tags)) {
        throw new Error("Invalid scan payload: locationId and tags array are required.");
      }

      // Package for AMQP queue
      const amqpPayload = {
        tenantId,
        locationId: data.locationId,
        tags: data.tags.map((t: any) => ({
          epc: t.epc,
          rssi: t.rssi ?? null,
        })),
        timestamp: new Date().toISOString(),
      };

      if (!this.amqpChannel) {
        throw new Error("AMQP channel not initialized.");
      }

      this.amqpChannel.sendToQueue(
        "rfid_bulk_scans",
        Buffer.from(JSON.stringify(amqpPayload)),
        { persistent: true }
      );

      Logger.info({
        context: "MqttIngestService",
        message: `[MqttIngestService] Queued scan batch of ${data.tags.length} tags to AMQP for tenant "${tenantId}" at location "${data.locationId}"`,
      });
    } catch (err: any) {
      Logger.error({
        context: "MqttIngestService",
        message: `Failed to process MQTT message on topic ${topic}:`,
        error: err.message || err,
      });
    }
  }

  public async stop(): Promise<void> {
    if (this.mqttClient) {
      this.mqttClient.end();
      this.mqttClient = null;
    }
    if (this.amqpChannel) {
      await this.amqpChannel.close();
      this.amqpChannel = null;
    }
    if (this.amqpConnection) {
      await this.amqpConnection.close();
      this.amqpConnection = null;
    }
    Logger.info({
      context: "MqttIngestService",
      message: "Stopped MqttIngestService",
    });
  }
}
