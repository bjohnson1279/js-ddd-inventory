import { IDomainEvent } from "./IDomainEvent";

export type DomainEventHandler<T extends IDomainEvent> = (event: T) => void | Promise<void>;

export class DomainEventDispatcher {
  private static handlers: Map<string, DomainEventHandler<any>[]> = new Map();

  public static register<T extends IDomainEvent>(
    eventName: string,
    handler: DomainEventHandler<T>
  ): void {
    const eventHandlers = this.handlers.get(eventName) || [];
    eventHandlers.push(handler);
    this.handlers.set(eventName, eventHandlers);
  }

  public static async dispatch(events: IDomainEvent[]): Promise<void> {
    for (const event of events) {
      const eventHandlers = this.handlers.get(event.eventName);
      if (eventHandlers) {
        for (const handler of eventHandlers) {
          // Catch errors so one failing handler doesn't prevent others from running
          try {
            await handler(event);
          } catch (error) {
            console.error(`Error handling domain event ${event.eventName}:`, error);
          }
        }
      }
    }
  }

  public static clearHandlers(): void {
    this.handlers.clear();
  }
}
