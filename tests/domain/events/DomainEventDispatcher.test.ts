import { DomainEventDispatcher } from "../../../src/domain/events/DomainEventDispatcher";
import { IDomainEvent } from "../../../src/domain/events/IDomainEvent";

class TestEvent implements IDomainEvent {
  public eventName = "TestEvent";
  public occurredOn = new Date();
  constructor(public data: string) {}
}

describe("DomainEventDispatcher", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    DomainEventDispatcher.clearHandlers();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should register and dispatch events to handlers", async () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    DomainEventDispatcher.register("TestEvent", handler1);
    DomainEventDispatcher.register("TestEvent", handler2);

    const event = new TestEvent("test data");
    await DomainEventDispatcher.dispatch([event]);

    expect(handler1).toHaveBeenCalledWith(event);
    expect(handler2).toHaveBeenCalledWith(event);
  });

  it("should catch handler errors and throw them after processing", async () => {
    const handler1 = jest.fn().mockImplementation(() => {
      throw new Error("Handler 1 failed");
    });
    const handler2 = jest.fn();

    DomainEventDispatcher.register("TestEvent", handler1);
    DomainEventDispatcher.register("TestEvent", handler2);

    const event = new TestEvent("test data");

    await expect(DomainEventDispatcher.dispatch([event])).rejects.toThrow("Handler 1 failed");

    expect(handler1).toHaveBeenCalledWith(event);
    expect(handler2).toHaveBeenCalledWith(event);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error handling domain event TestEvent:", expect.any(Error));
  });

  it("should handle string thrown errors", async () => {
    const handler1 = jest.fn().mockImplementation(() => {
      throw "String error";
    });

    DomainEventDispatcher.register("TestEvent", handler1);

    const event = new TestEvent("test data");

    await expect(DomainEventDispatcher.dispatch([event])).rejects.toThrow("String error");
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error handling domain event TestEvent:", "String error");
  });
});
