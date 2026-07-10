import { Kafka, Producer } from "kafkajs";
import { IMessageBroker } from "../../application/ports/IMessageBroker";
import { IDomainEvent } from "../../domain/events/IDomainEvent";
import { getTraceId } from "../telemetry/traceContext";

export class KafkaMessageBroker implements IMessageBroker {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private brokerUrl: string;

  constructor(brokerUrl: string) {
    this.brokerUrl = brokerUrl;
    // URL can be comma-separated list of brokers
    const brokers = this.brokerUrl ? this.brokerUrl.split(",") : ["localhost:9092"];
    this.kafka = new Kafka({
      clientId: "js-ddd-inventory",
      brokers: brokers,
      retry: {
        initialRetryTime: 300,
        retries: 5
      }
    });
  }

  public async connect(): Promise<void> {
    if (this.producer) return;
    try {
      this.producer = this.kafka.producer();
      await this.producer.connect();
      console.info(JSON.stringify({
        context: "KafkaMessageBroker",
        message: "Connected to Kafka bootstrap brokers",
        brokerUrl: this.brokerUrl
      }));
    } catch (err: any) {
      console.error(JSON.stringify({
        context: "KafkaMessageBroker",
        message: "Connection failed",
        error: err.message || err
      }));
      this.producer = null;
      throw err;
    }
  }

  public async publish(topic: string, event: IDomainEvent): Promise<void> {
    if (!this.producer) {
      await this.connect();
    }
    if (!this.producer) {
      throw new Error("[KafkaMessageBroker] Producer not connected.");
    }

    const payload = {
      ...event,
      occurredOn: event.occurredOn instanceof Date ? event.occurredOn.toISOString() : event.occurredOn
    };

    const traceId = getTraceId();

    try {
      await this.producer.send({
        topic: topic,
        messages: [
          {
            key: event.tenantId || "default",
            value: JSON.stringify(payload),
            headers: {
              "x-trace-id": traceId
            }
          }
        ]
      });
      console.info(JSON.stringify({
        context: "KafkaMessageBroker",
        message: "Successfully published event",
        traceId: traceId,
        event: event.constructor.name,
        topic: topic
      }));
    } catch (err: any) {
      console.error(JSON.stringify({
        context: "KafkaMessageBroker",
        message: "Failed to publish event",
        traceId: traceId,
        topic: topic,
        error: err.message || err
      }));
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
      console.info(JSON.stringify({
        context: "KafkaMessageBroker",
        message: "Disconnected from Kafka"
      }));
    }
  }
}
