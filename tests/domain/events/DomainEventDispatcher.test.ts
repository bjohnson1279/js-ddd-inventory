import { DomainEventDispatcher } from "../../../src/domain/events/DomainEventDispatcher";
import { IDomainEvent } from "../../../src/domain/events/IDomainEvent";

class DummyEvent implements IDomainEvent {
  public readonly occurredOn: Date = new Date();
  public readonly eventName: string = "DummyEvent";
  constructor(public readonly payload: string) {}
}

describe("DomainEventDispatcher", () => {
  beforeEach(() => {
    DomainEventDispatcher.clearHandlers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should dispatch events to registered handlers", async () => {
    const handler = jest.fn();
    DomainEventDispatcher.register("DummyEvent", handler);

    const event = new DummyEvent("test-payload");
    await DomainEventDispatcher.dispatch([event]);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it("should properly catch exceptions from handlers, log them, and re-throw the first error", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const failingHandler = jest.fn().mockImplementation(() => {
      throw new Error("Handler failed");
    });

    DomainEventDispatcher.register("DummyEvent", failingHandler);

    const event = new DummyEvent("test-payload");

    await expect(DomainEventDispatcher.dispatch([event])).rejects.toThrow("Handler failed");

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(`"message":"Error handling domain event DummyEvent in handler mockConstructor:"`)
    );
  });
});
