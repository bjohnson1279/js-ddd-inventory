import amqp from "amqplib";
import { IMessageBroker } from "../../application/ports/IMessageBroker";
import { IDomainEvent } from "../../domain/events/IDomainEvent";

export class RabbitMQMessageBroker implements IMessageBroker {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  public async connect(): Promise<void> {
    if (this.connection) return;
    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
      console.info(JSON.stringify({
        context: "RabbitMQMessageBroker",
        action: "connect",
        message: `Connected to RabbitMQ at ${this.url}`
      }));
    } catch (err: any) {
      console.error(JSON.stringify({
        context: "RabbitMQMessageBroker",
        action: "connect",
        message: "Connection failed",
        error: err.message || err
      }));
      throw err;
    }
  }

  public async publish(topic: string, event: IDomainEvent): Promise<void> {
    if (!this.channel) {
      await this.connect();
    }
    if (!this.channel) {
      throw new Error("[RabbitMQMessageBroker] Channel not initialized.");
    }
    const exchangeName = "domain_events";
    await this.channel.assertExchange(exchangeName, "topic", { durable: true });
    
    // Normalize event date to string for serialization
    const payload = {
      ...event,
      occurredOn: event.occurredOn instanceof Date ? event.occurredOn.toISOString() : event.occurredOn
    };

    const message = Buffer.from(JSON.stringify(payload));
    this.channel.publish(exchangeName, topic, message, { persistent: true });
    console.info(JSON.stringify({
      context: "RabbitMQMessageBroker",
      action: "publish",
      message: `Published to exchange "${exchangeName}" with routing key "${topic}"`
    }));
  }

  public async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
    console.info(JSON.stringify({
      context: "RabbitMQMessageBroker",
      action: "disconnect",
      message: "Disconnected from RabbitMQ"
    }));
  }
}
