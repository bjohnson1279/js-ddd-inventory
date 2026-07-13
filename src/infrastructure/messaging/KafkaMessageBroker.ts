import { Kafka, Producer } from "kafkajs";
import { IMessageBroker } from "../../application/ports/IMessageBroker";
import { IDomainEvent } from "../../domain/events/IDomainEvent";

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
      console.log(`[KafkaMessageBroker] Connected to Kafka bootstrap brokers at: ${this.brokerUrl}`);
    } catch (err: any) {
      console.error("[KafkaMessageBroker] Connection failed:", err.message || err);
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

    try {
      await this.producer.send({
        topic: topic,
        messages: [
          {
            key: event.tenantId || "default",
            value: JSON.stringify(payload)
          }
        ]
      });
      console.log(`[KafkaMessageBroker] Successfully published event "${event.constructor.name}" to topic "${topic}"`);
    } catch (err: any) {
      console.error(`[KafkaMessageBroker] Failed to publish event to topic "${topic}":`, err.message || err);
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
      console.log("[KafkaMessageBroker] Disconnected from Kafka");
    }
  }
}
