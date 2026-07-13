import { IMessageBroker } from "../../application/ports/IMessageBroker";
import { IDomainEvent } from "../../domain/events/IDomainEvent";
import { Logger } from "../logging/logger";

export class InMemoryMessageBroker implements IMessageBroker {
  private publishedEvents: Array<{ topic: string; event: IDomainEvent }> = [];

  public async publish(topic: string, event: IDomainEvent): Promise<void> {
    this.publishedEvents.push({ topic, event });
    Logger.info({
      context: "InMemoryMessageBroker",
      action: "publish",
      topic,
      event
    });
  }

  public getPublishedEvents() {
    return this.publishedEvents;
  }

  public clear(): void {
    this.publishedEvents = [];
  }
}
