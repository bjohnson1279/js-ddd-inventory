import amqp from "amqplib";
import { IMessageBroker } from "../../application/ports/IMessageBroker";
import { IDomainEvent } from "../../domain/events/IDomainEvent";
import { Logger } from "../logging/logger";

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
      Logger.info({
        context: "RabbitMQMessageBroker",
        action: "connect",
        url: this.url,
        message: "Connected to RabbitMQ"
      });
    } catch (err: any) {
      Logger.error({
        context: "RabbitMQMessageBroker",
        action: "connect",
        message: "Connection failed"
      }, err);
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
    Logger.info({
      context: "RabbitMQMessageBroker",
      action: "publish",
      exchangeName,
      topic,
      message: "Published to exchange"
    });
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
    Logger.info({
      context: "RabbitMQMessageBroker",
      action: "disconnect",
      message: "Disconnected from RabbitMQ"
    });
  }
}
