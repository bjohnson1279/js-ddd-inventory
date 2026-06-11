import { IDomainEvent } from "../../domain/events/IDomainEvent";

export interface IMessageBroker {
  publish(topic: string, event: IDomainEvent): Promise<void>;
}
