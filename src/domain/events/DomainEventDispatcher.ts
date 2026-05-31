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
    const errors: any[] = [];
    for (const event of events) {
      const eventHandlers = this.handlers.get(event.eventName);
      if (eventHandlers) {
        for (const handler of eventHandlers) {
          try {
            await handler(event);
          } catch (error) {
            console.error(`Error handling domain event ${event.eventName}:`, error);
            errors.push(error);
          }
        }
      }
    }
    if (errors.length > 0) {
      throw new Error(errors[0].message || String(errors[0]));
    }
  }

  public static clearHandlers(): void {
    this.handlers.clear();
  }
}
