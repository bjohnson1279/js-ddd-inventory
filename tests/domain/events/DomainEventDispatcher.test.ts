import { DomainEventDispatcher } from "../../../src/domain/events/DomainEventDispatcher";
import { IDomainEvent } from "../../../src/domain/events/IDomainEvent";

class TestEvent implements IDomainEvent {
  public eventName = "TestEvent";
  public occurredOn = new Date();
  constructor(public data: string) {}
}

describe("DomainEventDispatcher", () => {
  beforeEach(() => {
    DomainEventDispatcher.clearHandlers();
  });

  afterEach(() => {
    DomainEventDispatcher.clearHandlers();
  });

  it("should dispatch events to registered handlers successfully", async () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    DomainEventDispatcher.register("TestEvent", handler1);
    DomainEventDispatcher.register("TestEvent", handler2);

    const event = new TestEvent("test data");

    await DomainEventDispatcher.dispatch([event]);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler1).toHaveBeenCalledWith(event);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledWith(event);
  });

  it("should propagate errors when a handler throws an exception", async () => {
    const errorMessage = "Handler failed intentionally";
    const throwingHandler = jest.fn().mockImplementation(() => {
      throw new Error(errorMessage);
    });
    const successfulHandler = jest.fn();

    DomainEventDispatcher.register("TestEvent", successfulHandler);
    DomainEventDispatcher.register("TestEvent", throwingHandler);

    const event = new TestEvent("error test data");

    // The original console.error inside DomainEventDispatcher.dispatch
    // will still be called, which is expected. We could mock it to silence it
    // during tests, but it's not strictly necessary. Let's silence it.
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(DomainEventDispatcher.dispatch([event])).rejects.toThrow(errorMessage);

    expect(successfulHandler).toHaveBeenCalledTimes(1);
    expect(throwingHandler).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  it("should properly accumulate multiple errors and throw the first one", async () => {
      const errorMessage1 = "First failure";
      const errorMessage2 = "Second failure";

      const throwingHandler1 = jest.fn().mockImplementation(() => {
        throw new Error(errorMessage1);
      });
      const throwingHandler2 = jest.fn().mockImplementation(() => {
        throw new Error(errorMessage2);
      });

      DomainEventDispatcher.register("TestEvent", throwingHandler1);
      DomainEventDispatcher.register("TestEvent", throwingHandler2);

      const event = new TestEvent("multiple error test data");

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(DomainEventDispatcher.dispatch([event])).rejects.toThrow(errorMessage1);

      expect(throwingHandler1).toHaveBeenCalledTimes(1);
      expect(throwingHandler2).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });
});
